/* =========================================================
   REPOSITORY  (컬렉션 <-> 테이블)
   -----------------------------------------------------------
   server/collections.js 의 매핑 정의만 보고 SQL 을 만든다.
   테이블마다 손으로 쓴 쿼리가 없으므로, 필드를 추가할 때
   고칠 곳은 collections.js 한 곳뿐이다.

   어댑터 계약(src/data/adapters/rest.js)상의 중요한 전제:
     화면은 부분 갱신을 보내지 않는다. store.js 의 dbUpdate 가
     deepMerge 로 병합을 끝낸 "레코드 전체" 를 보낸다. 따라서
     PUT 과 PATCH 는 서버 입장에서 완전히 같은 연산이고, 여기서는
     replace() 하나로 처리한다.

   ★ 자식 배열은 매번 통째로 지우고 다시 넣는다.
     화면이 배열 전체를 보내오고, 순서(인덱스)가 화면 동작의
     일부이기 때문이다 — employee-drawer 의 수습 평가 삭제는
     배열 인덱스로 지운다. ord 컬럼이 그 순서를 보존한다.
   ========================================================= */

import { COLLECTIONS, SETTINGS, getPath, setPath, ensureNestedRoots } from "./collections.js";
import { getPool, withRetry, toParam, fromColumn, newId, sql } from "./db.js";

/** 읽을 때 row 에서 꺼낼 실제 속성 이름 ([role] -> role) */
function rowKey(def) {
  return def.plainCol || def.col;
}

/** 자식 테이블 정렬 기준: 부모별 ord */
function childOrderBy(child) {
  return `${child.parentCol}, ord`;
}

/* ---------------------------------------------------------
   읽기
   --------------------------------------------------------- */

function buildRecord(row, def) {
  const rec = { id: row.id };
  for (const [field, colDef] of Object.entries(def.columns)) {
    const value = fromColumn(colDef.type, row[rowKey(colDef)]);
    // null 은 넣지 않는다 — 문서 모양을 원본(localStorage 시절)에 맞춘다.
    if (value !== null) setPath(rec, field, value);
  }
  ensureNestedRoots(rec, def);
  return rec;
}

function buildChildRecord(row, childDef) {
  const rec = {};
  for (const [field, colDef] of Object.entries(childDef.columns)) {
    const value = fromColumn(colDef.type, row[rowKey(colDef)]);
    if (value !== null) rec[field] = value;
  }
  return rec;
}

/** 한 컬렉션의 모든 레코드를 자식까지 조립해서 돌려준다. */
async function loadCollection(pool, path) {
  const def = COLLECTIONS[path];
  const cols = Object.values(def.columns).map((c) => c.col).join(", ");
  const rows = (await pool.request().query(`SELECT id, ${cols} FROM dbo.${def.table} ORDER BY seq`)).recordset;
  const records = rows.map((r) => buildRecord(r, def));

  for (const [field, child] of Object.entries(def.children || {})) {
    const byId = new Map(records.map((r) => [r.id, r]));
    const childCols = Object.values(child.columns).map((c) => c.col).join(", ");
    const childRows = (
      await pool.request().query(
        `SELECT ${child.parentCol}, ${childCols} FROM dbo.${child.table} ORDER BY ${childOrderBy(child)}`
      )
    ).recordset;

    const grouped = new Map();
    for (const row of childRows) {
      const parentId = row[child.parentCol];
      if (!grouped.has(parentId)) grouped.set(parentId, []);
      grouped.get(parentId).push(buildChildRecord(row, child));
    }
    // 빈 배열은 넣지 않는다 (읽는 쪽이 전부 `|| []` 로 방어한다).
    for (const [parentId, list] of grouped) {
      const rec = byId.get(parentId);
      if (rec) setPath(rec, field, list);
    }
  }

  return records;
}

/** GET /api/collections — 전체 스냅샷 */
export async function loadAll() {
  return withRetry(async () => {
    const pool = await getPool();
    const out = {};
    for (const path of Object.keys(COLLECTIONS)) {
      out[path] = await loadCollection(pool, path);
    }
    return out;
  }, "loadAll");
}

/* ---------------------------------------------------------
   쓰기
   --------------------------------------------------------- */

/** 매핑에 없는 키를 찾아낸다 (개발 중 실수로 필드를 흘리는 것 방지) */
export function unmappedKeys(path, record) {
  const def = COLLECTIONS[path];
  const known = new Set(["id"]);
  Object.keys(def.columns).forEach((f) => known.add(f.split(".")[0]));
  Object.keys(def.children || {}).forEach((f) => known.add(f.split(".")[0]));
  return Object.keys(record || {}).filter((k) => !known.has(k));
}

function addParams(request, def, record, prefix = "p") {
  const assignments = [];
  let i = 0;
  for (const [field, colDef] of Object.entries(def.columns)) {
    const name = `${prefix}${i++}`;
    const { sqlType, value } = toParam(colDef.type, getPath(record, field));
    request.input(name, sqlType, value);
    assignments.push({ col: colDef.col, param: name, value });
  }
  return assignments;
}

/**
 * INSERT 에서는 값이 null 인 컬럼을 아예 빼야 한다.
 * ---------------------------------------------------------
 * created_at 처럼 NOT NULL + DEFAULT 인 컬럼에 명시적으로 NULL 을
 * 넣으면 DEFAULT 가 적용되지 않고 제약 위반으로 실패한다. 컬럼을
 * 빼면 테이블 기본값이 적용된다.
 *
 * UPDATE 에는 이 규칙을 적용하지 않는다 — 거기서의 null 은 "값을
 * 지운다"는 뜻이라 명시적으로 써야 한다.
 */
function insertable(assignments) {
  return assignments.filter((a) => a.value !== null);
}

/** 자식 배열을 지우고 현재 배열로 다시 채운다. 순서는 ord 로 보존. */
async function rewriteChildren(tx, def, parentId, record) {
  for (const [field, child] of Object.entries(def.children || {})) {
    const del = new sql.Request(tx);
    del.input("parentId", sql.NVarChar(50), parentId);
    await del.query(`DELETE FROM dbo.${child.table} WHERE ${child.parentCol} = @parentId`);

    const list = getPath(record, field);
    if (!Array.isArray(list) || list.length === 0) continue;

    for (let ord = 0; ord < list.length; ord++) {
      const item = list[ord] || {};
      const req = new sql.Request(tx);
      req.input("id", sql.NVarChar(50), newId());
      req.input("parentId", sql.NVarChar(50), parentId);
      req.input("ord", sql.Int, ord);

      const cols = [];
      const params = [];
      let i = 0;
      for (const [itemField, colDef] of Object.entries(child.columns)) {
        const name = `c${i++}`;
        const { sqlType, value } = toParam(colDef.type, item[itemField]);
        req.input(name, sqlType, value);
        // 부모와 같은 이유로 null 컬럼은 뺀다 (insertable 주석 참고).
        if (value === null) continue;
        cols.push(colDef.col);
        params.push(`@${name}`);
      }
      await req.query(
        `INSERT INTO dbo.${child.table} (id, ${child.parentCol}, ord, ${cols.join(", ")})
         VALUES (@id, @parentId, @ord, ${params.join(", ")})`
      );
    }
  }
}

/** POST /api/:collection — 새 레코드. 서버가 id 를 발급한다. */
export async function insert(path, record) {
  const def = COLLECTIONS[path];
  return withRetry(async () => {
    const pool = await getPool();
    const id = newId();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const req = new sql.Request(tx);
      req.input("id", sql.NVarChar(50), id);
      const assignments = insertable(addParams(req, def, record));
      await req.query(
        `INSERT INTO dbo.${def.table} (id, ${assignments.map((a) => a.col).join(", ")})
         VALUES (@id, ${assignments.map((a) => "@" + a.param).join(", ")})`
      );
      await rewriteChildren(tx, def, id, record);
      await tx.commit();
      return id;
    } catch (err) {
      try { await tx.rollback(); } catch { /* 이미 롤백된 경우 무시 */ }
      throw err;
    }
  }, `insert ${path}`);
}

/**
 * PUT/PATCH /api/:collection/:id — 레코드 전체 교체.
 * 없는 id 면 false 를 돌려준다(라우터가 404 로 바꾼다).
 */
export async function replace(path, id, record) {
  const def = COLLECTIONS[path];
  return withRetry(async () => {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const req = new sql.Request(tx);
      req.input("id", sql.NVarChar(50), id);
      const assignments = addParams(req, def, record);
      const setClause = assignments.map((a) => `${a.col} = @${a.param}`).join(", ");
      const result = await req.query(
        `UPDATE dbo.${def.table} SET ${setClause}, updated_at = SYSUTCDATETIME() WHERE id = @id`
      );
      if (result.rowsAffected[0] === 0) {
        await tx.rollback();
        return false;
      }
      await rewriteChildren(tx, def, id, record);
      await tx.commit();
      return true;
    } catch (err) {
      try { await tx.rollback(); } catch { /* 무시 */ }
      throw err;
    }
  }, `replace ${path}`);
}

/** DELETE /api/:collection/:id — 자식은 FK CASCADE 로 함께 지워진다. */
export async function remove(path, id) {
  const def = COLLECTIONS[path];
  return withRetry(async () => {
    const pool = await getPool();
    const req = pool.request();
    req.input("id", sql.NVarChar(50), id);
    const result = await req.query(`DELETE FROM dbo.${def.table} WHERE id = @id`);
    return result.rowsAffected[0] > 0;
  }, `remove ${path}`);
}

/* ---------------------------------------------------------
   앱 설정 (단일 행)
   --------------------------------------------------------- */

/** GET /api/settings — 아직 저장된 적이 없으면 null */
export async function readSettings() {
  return withRetry(async () => {
    const pool = await getPool();
    const cols = Object.values(SETTINGS.columns).map((c) => c.col).join(", ");
    const rows = (await pool.request().query(`SELECT ${cols} FROM dbo.${SETTINGS.table} WHERE id = 1`)).recordset;
    if (!rows.length) return null;
    const doc = {};
    for (const [field, colDef] of Object.entries(SETTINGS.columns)) {
      const value = fromColumn(colDef.type, rows[0][rowKey(colDef)]);
      if (value !== null) doc[field] = value;
    }
    return doc;
  }, "readSettings");
}

/** PUT /api/settings — 단일 행 upsert */
export async function writeSettings(doc) {
  return withRetry(async () => {
    const pool = await getPool();
    const req = pool.request();
    const cols = [];
    const params = [];
    let i = 0;
    for (const [field, colDef] of Object.entries(SETTINGS.columns)) {
      const name = `s${i++}`;
      const { sqlType, value } = toParam(colDef.type, doc ? doc[field] : undefined);
      req.input(name, sqlType, value);
      cols.push(colDef.col);
      params.push(name);
    }
    const setClause = cols.map((c, idx) => `${c} = @${params[idx]}`).join(", ");
    await req.query(
      `MERGE dbo.${SETTINGS.table} AS target
       USING (SELECT 1 AS id) AS src ON target.id = src.id
       WHEN MATCHED THEN UPDATE SET ${setClause}, updated_at = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN INSERT (id, ${cols.join(", ")}, updated_at)
            VALUES (1, ${params.map((p) => "@" + p).join(", ")}, SYSUTCDATETIME());`
    );
  }, "writeSettings");
}
