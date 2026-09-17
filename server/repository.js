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

import { COLLECTIONS, SETTINGS, PASSWORD_COLUMNS, getPath, setPath, ensureNestedRoots } from "./collections.js";
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

/**
 * 컬렉션이 직원에 매여 있는 방식.
 *   "self"     employees — 레코드 자신의 id 가 곧 직원 id
 *   "employee" employeeId 컬럼으로 직원을 가리킨다
 *   null       직원과 무관한 공용 마스터 (projects, subsidy_programs)
 */
export function ownershipKind(path) {
  if (path === "employees") return "self";
  return COLLECTIONS[path].columns.employeeId ? "employee" : null;
}

/**
 * GET /api/collections — 전체 스냅샷
 *
 * visibleIds 가 Set 이면 그 직원들만 보인다. null 이면 제한 없음.
 * 규칙은 화면의 applyDivisionScope()(src/data/store.js)와 같아야 한다 —
 * 다만 이제 서버가 거르므로, 화면을 우회해 API 를 직접 불러도 범위를
 * 넘은 데이터는 나오지 않는다.
 */
export async function loadAll(visibleIds = null) {
  return withRetry(async () => {
    const pool = await getPool();
    const out = {};
    for (const path of Object.keys(COLLECTIONS)) {
      const records = await loadCollection(pool, path);
      if (!visibleIds) {
        out[path] = records;
        continue;
      }
      const kind = ownershipKind(path);
      if (kind === "self") out[path] = records.filter((r) => visibleIds.has(r.id));
      else if (kind === "employee") out[path] = records.filter((r) => visibleIds.has(r.employeeId));
      else out[path] = records; // 공용 마스터는 그대로
    }
    return out;
  }, "loadAll");
}

/**
 * 역할의 노출 범위. 한 번의 설정 조회로 둘 다 돌려준다.
 *   divisions   허용 사업부 목록 (빈 배열 = 제한 없음)
 *   visibleIds  허용 직원 id 집합 (null = 제한 없음)
 *
 * 화면과 같은 규칙: 사업부가 비어 있으면 "미지정" 으로 친다.
 */
export async function scopeFor(role) {
  const settings = await readSettings();
  const configured = settings && settings.visibleDivisions ? settings.visibleDivisions[role] : null;
  const divisions = Array.isArray(configured) ? configured.filter((d) => typeof d === "string") : [];
  if (divisions.length === 0) return { divisions: [], visibleIds: null }; // 제한 없음

  const visibleIds = await idsInDivisions(divisions);
  return { divisions, visibleIds };
}

async function idsInDivisions(divisions) {
  return withRetry(async () => {
    const pool = await getPool();
    const req = pool.request();
    const params = divisions.map((d, i) => {
      req.input(`d${i}`, sql.NVarChar(50), d);
      return `@d${i}`;
    });
    const rows = (
      await req.query(
        `SELECT id FROM dbo.employees
          WHERE ISNULL(NULLIF(division, N''), N'미지정') IN (${params.join(", ")})`
      )
    ).recordset;
    return new Set(rows.map((r) => r.id));
  }, "idsInDivisions");
}

/**
 * 레코드가 매여 있는 직원 id. 레코드가 없으면 undefined,
 * 직원과 무관한 컬렉션이면 null.
 */
export async function owningEmployeeId(path, id) {
  const kind = ownershipKind(path);
  if (kind === null) return null;
  const def = COLLECTIONS[path];
  const col = kind === "self" ? "id" : "employee_id";
  return withRetry(async () => {
    const pool = await getPool();
    const req = pool.request();
    req.input("id", sql.NVarChar(50), id);
    const rows = (await req.query(`SELECT ${col} AS owner FROM dbo.${def.table} WHERE id = @id`)).recordset;
    return rows.length ? rows[0].owner : undefined;
  }, `owningEmployeeId ${path}`);
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
    assignments.push({ col: colDef.col, param: name, value, immutable: !!colDef.immutable });
  }
  return assignments;
}

/**
 * UPDATE 에서 빼야 할 컬럼을 걸러낸다.
 * ---------------------------------------------------------
 * created_at 은 생성 시각이라 수정 대상이 아니다. 게다가 NOT NULL 이라,
 * 화면이 createdAt 없이 보낸 레코드를 그대로 UPDATE 하면 NULL 이 써져
 * 제약 위반이 난다. 아예 SET 목록에서 뺀다.
 */
function updatable(assignments) {
  return assignments.filter((a) => !a.immutable);
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
      const assignments = updatable(addParams(req, def, record));
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

/* ---------------------------------------------------------
   암호 해시 — 설정 문서와 분리해서 다룬다
   ---------------------------------------------------------
   같은 app_settings 행에 들어 있지만, readSettings/writeSettings 의
   매핑에서는 일부러 빠져 있다. 암호가 GET /api/settings 응답에
   섞여 나가는 일이 없도록 경로 자체를 나눈 것이다.
   --------------------------------------------------------- */

function passwordColumn(role) {
  const col = PASSWORD_COLUMNS[role];
  if (!col) throw new Error(`알 수 없는 역할: ${role}`);
  return col;
}

/** 저장된 해시. 한 번도 설정한 적이 없으면 null (기본 암호를 쓴다는 뜻) */
export async function readPasswordHash(role) {
  const col = passwordColumn(role);
  return withRetry(async () => {
    const pool = await getPool();
    const rows = (await pool.request().query(`SELECT ${col} AS hash FROM dbo.${SETTINGS.table} WHERE id = 1`)).recordset;
    return rows.length && rows[0].hash ? String(rows[0].hash) : null;
  }, `readPasswordHash ${role}`);
}

/** 해시를 저장한다. 설정 행이 없으면 만든다. */
export async function writePasswordHash(role, hash) {
  const col = passwordColumn(role);
  return withRetry(async () => {
    const pool = await getPool();
    const req = pool.request();
    req.input("hash", sql.NVarChar(200), hash);
    await req.query(
      `MERGE dbo.${SETTINGS.table} AS target
       USING (SELECT 1 AS id) AS src ON target.id = src.id
       WHEN MATCHED THEN UPDATE SET ${col} = @hash, updated_at = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN INSERT (id, ${col}, updated_at) VALUES (1, @hash, SYSUTCDATETIME());`
    );
  }, `writePasswordHash ${role}`);
}
