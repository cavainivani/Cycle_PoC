/* =========================================================
   API ROUTER  (/api)
   -----------------------------------------------------------
   src/data/adapters/rest.js 가 기대하는 계약을 그대로 구현한다.

     GET    /api/collections        -> { employees:[...], contracts:[...], ... }
     POST   /api/:collection        -> { id }
     PUT    /api/:collection/:id    -> 204
     PATCH  /api/:collection/:id    -> 204
     DELETE /api/:collection/:id    -> 204
     GET    /api/settings           -> 설정 문서 또는 null
     PUT    /api/settings           -> 204

   부가 엔드포인트 (계약 외):
     GET    /api/health/db          -> DB 왕복 확인 (서버리스 깨우기용)

   ★ 라우트 순서 주의
     /collections 와 /settings 는 /:collection 보다 먼저 선언해야
     한다. Express 는 선언 순서대로 매칭하므로 뒤에 두면 컬렉션
     이름으로 잡아먹힌다.
   ========================================================= */

import express from "express";
import { COLLECTIONS } from "./collections.js";
import * as repo from "./repository.js";
import { getPool, withRetry } from "./db.js";
import {
  DEFAULT_SYSTEM_PASSWORD,
  hashPassword,
  verifyPassword,
  safeEqualString,
  setSessionCookie,
  clearSessionCookie,
  sessionOf,
  requireAuth,
  requireAdmin,
  canWrite,
} from "./auth.js";

const isDev = process.env.NODE_ENV !== "production";

const ROLES = ["admin", "pmo"];

/**
 * 역할의 암호를 검사한다.
 * 저장된 해시가 없으면 초기 암호(0000000000)와 비교한다 — 설정을
 * 한 번도 저장하지 않은 상태에서도 로그인할 수 있어야 하기 때문이다.
 */
async function checkPassword(role, plain) {
  const stored = await repo.readPasswordHash(role);
  if (stored) return verifyPassword(plain, stored);
  return safeEqualString(plain, DEFAULT_SYSTEM_PASSWORD);
}

/** async 핸들러의 예외를 express 에러 미들웨어로 넘긴다. */
function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * :collection 을 허용 목록으로만 해석한다.
 * 테이블 이름은 이 맵에서만 나오므로 사용자 입력이 SQL 에 닿지 않는다.
 */
function resolveCollection(req, res) {
  const path = req.params.collection;
  if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, path)) {
    res.status(404).json({ error: "unknown_collection", collection: path });
    return null;
  }
  return path;
}

/** 본문이 객체인지 확인 */
function requireObjectBody(req, res) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "invalid_body", message: "JSON 객체를 보내 주세요." });
    return null;
  }
  return body;
}

/** 개발 중에만 — 매핑에 없어서 버려진 키를 알린다 */
function warnUnmapped(path, record) {
  if (!isDev) return;
  const extra = repo.unmappedKeys(path, record);
  if (extra.length) {
    console.warn(`[api] ${path}: 매핑에 없어 저장되지 않는 키 — ${extra.join(", ")}`);
  }
}

/* ---------------------------------------------------------
   사업부 노출 범위
   -----------------------------------------------------------
   화면에도 같은 필터가 있지만(src/data/store.js 의 applyDivisionScope),
   그건 표시용이다. 화면을 거치지 않고 API 를 직접 불러도 범위를 넘지
   못하게 하는 것은 여기가 유일하다.
   --------------------------------------------------------- */

/**
 * 역할이 이 컬렉션에 쓸 수 있는지 검사한다.
 * 화면에서 도달할 수 없는 곳은 API 로도 막는다 (auth.js 의 WRITE_PERMISSIONS).
 */
function ensureCanWrite(req, res, path) {
  if (canWrite(req.session.role, path, req.method)) return true;
  res.status(403).json({
    error: "forbidden",
    message: "이 작업을 할 권한이 없습니다.",
    collection: path,
  });
  return false;
}

/** 이 요청의 노출 범위 { divisions, visibleIds } — 설정 조회는 한 번만 */
function scopeOf(req) {
  return repo.scopeFor(req.session.role);
}

/**
 * 기존 레코드를 건드릴 수 있는지 검사한다.
 * 범위를 벗어나면 응답을 보내고 false 를 돌려준다.
 *
 * 없는 레코드와 범위 밖 레코드를 모두 404 로 답한다 — 403 으로 나누면
 * "그 id 는 존재한다" 는 정보가 새기 때문이다.
 */
async function ensureInScope(req, res, path, id) {
  const { visibleIds } = await scopeOf(req);
  if (!visibleIds) return true; // 제한 없음
  const owner = await repo.owningEmployeeId(path, id);
  if (owner === null) return true; // 직원과 무관한 공용 마스터
  if (owner === undefined || !visibleIds.has(owner)) {
    res.status(404).json({ error: "not_found", collection: path, id });
    return false;
  }
  return true;
}

/** 새로 만드는 레코드가 범위 안인지 검사한다. */
async function ensureNewInScope(req, res, path, record) {
  const { divisions, visibleIds } = await scopeOf(req);
  if (!visibleIds) return true;
  const kind = repo.ownershipKind(path);
  if (kind === null) return true;

  if (kind === "employee") {
    const employeeId = record && record.employeeId;
    if (!employeeId || !visibleIds.has(employeeId)) {
      res.status(403).json({ error: "out_of_scope", message: "노출 범위를 벗어난 직원입니다." });
      return false;
    }
    return true;
  }

  // employees 신규 등록 — 아직 id 가 없으므로 사업부로 판단한다.
  // 자기 범위 밖 사업부로 직원을 만들어 두는 것을 막는다.
  const division = (record && record.division) || "미지정";
  if (!divisions.includes(division)) {
    res.status(403).json({ error: "out_of_scope", message: "노출 범위를 벗어난 사업부입니다." });
    return false;
  }
  return true;
}

export function createApiRouter() {
  const api = express.Router();

  /* ---------- 상태 확인 ---------- */
  api.get(
    "/health/db",
    wrap(async (req, res) => {
      const startedAt = Date.now();
      await withRetry(async () => {
        const pool = await getPool();
        await pool.request().query("SELECT 1 AS ok");
      }, "health");
      res.json({ ok: true, elapsedMs: Date.now() - startedAt });
    })
  );

  /* ---------- 로그인 / 로그아웃 (인증 불필요) ---------- */

  api.post(
    "/login",
    wrap(async (req, res) => {
      const body = requireObjectBody(req, res);
      if (!body) return;
      const role = String(body.role || "");
      const password = String(body.password || "");
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: "invalid_role" });
        return;
      }
      if (!(await checkPassword(role, password))) {
        // 어떤 역할이 틀렸는지 등 힌트를 주지 않는다.
        res.status(401).json({ error: "invalid_credentials", message: "암호가 올바르지 않습니다." });
        return;
      }
      setSessionCookie(res, role);
      res.json({ role });
    })
  );

  api.post("/logout", (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  /** 새로고침 후 로그인 상태를 복원할 때 쓴다. */
  api.get("/session", (req, res) => {
    const session = sessionOf(req);
    res.json(session ? { role: session.role } : null);
  });

  /* ---------- 여기서부터 로그인 필수 ---------- */
  api.use(requireAuth);

  /* ---------- 설정 (단일 문서) ---------- */
  // 응답에 암호는 포함되지 않는다 (collections.js 의 SETTINGS 주석 참고).
  api.get(
    "/settings",
    wrap(async (req, res) => {
      res.json(await repo.readSettings());
    })
  );

  // 설정 변경은 관리자 전용 화면이다.
  api.put(
    "/settings",
    requireAdmin,
    wrap(async (req, res) => {
      const body = requireObjectBody(req, res);
      if (!body) return;
      await repo.writeSettings(body);
      res.status(204).end();
    })
  );

  /* ---------- 암호 변경 (관리자 전용) ---------- */
  // 설정 문서와 경로를 나눈 이유: 설정 저장은 "문서 통째로 쓰기"라,
  // 조회 응답에서 암호를 빼고 나면 저장할 때 빈 값으로 덮여 날아간다.
  api.post(
    "/password",
    requireAdmin,
    wrap(async (req, res) => {
      const body = requireObjectBody(req, res);
      if (!body) return;
      const role = String(body.role || "");
      const newPassword = String(body.newPassword || "");
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: "invalid_role" });
        return;
      }
      if (newPassword.length < 4) {
        res.status(400).json({ error: "weak_password", message: "암호는 4자 이상이어야 합니다." });
        return;
      }
      await repo.writePasswordHash(role, await hashPassword(newPassword));
      res.status(204).end();
    })
  );

  /* ---------- 전체 스냅샷 ---------- */
  api.get(
    "/collections",
    wrap(async (req, res) => {
      const { visibleIds } = await scopeOf(req);
      res.json(await repo.loadAll(visibleIds));
    })
  );

  /* ---------- 컬렉션 CRUD ---------- */
  api.post(
    "/:collection",
    wrap(async (req, res) => {
      const path = resolveCollection(req, res);
      if (!path) return;
      if (!ensureCanWrite(req, res, path)) return;
      const body = requireObjectBody(req, res);
      if (!body) return;
      if (!(await ensureNewInScope(req, res, path, body))) return;
      warnUnmapped(path, body);
      const id = await repo.insert(path, body);
      res.status(201).json({ id });
    })
  );

  // PUT 과 PATCH 는 같은 연산이다 — 화면(store.js)이 항상 병합이 끝난
  // 레코드 전체를 보내기 때문이다. repository.replace() 주석 참고.
  const replaceHandler = wrap(async (req, res) => {
    const path = resolveCollection(req, res);
    if (!path) return;
    if (!ensureCanWrite(req, res, path)) return;
    const body = requireObjectBody(req, res);
    if (!body) return;
    if (!(await ensureInScope(req, res, path, req.params.id))) return;
    warnUnmapped(path, body);
    const outcome = await repo.replace(path, req.params.id, body);
    if (outcome === "notfound") {
      res.status(404).json({ error: "not_found", collection: path, id: req.params.id });
      return;
    }
    if (outcome === "conflict") {
      // 내가 읽은 뒤로 다른 사람이 저장했다. 덮어쓰지 않고 돌려보낸다.
      res.status(409).json({
        error: "conflict",
        message: "다른 사람이 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.",
        collection: path,
        id: req.params.id,
      });
      return;
    }
    res.status(204).end();
  });

  api.put("/:collection/:id", replaceHandler);
  api.patch("/:collection/:id", replaceHandler);

  api.delete(
    "/:collection/:id",
    wrap(async (req, res) => {
      const path = resolveCollection(req, res);
      if (!path) return;
      if (!ensureCanWrite(req, res, path)) return;
      if (!(await ensureInScope(req, res, path, req.params.id))) return;
      const ok = await repo.remove(path, req.params.id);
      if (!ok) {
        res.status(404).json({ error: "not_found", collection: path, id: req.params.id });
        return;
      }
      res.status(204).end();
    })
  );

  /* ---------- 오류 ---------- */
  api.use((req, res) => {
    res.status(404).json({ error: "unknown_endpoint", path: req.path, method: req.method });
  });

  // eslint-disable-next-line no-unused-vars -- express 는 인자 4개로 에러 미들웨어를 식별한다
  api.use((err, req, res, next) => {
    console.error(`[api] ${req.method} ${req.originalUrl} 실패:`, err);
    res.status(500).json({
      error: "server_error",
      // 상세 메시지는 개발 중에만 — 운영에서는 DB 구조가 새어나가지 않게 막는다.
      message: isDev ? String((err && err.message) || err) : "서버 오류가 발생했습니다.",
    });
  });

  return api;
}
