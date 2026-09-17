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
      res.json(await repo.loadAll());
    })
  );

  /* ---------- 컬렉션 CRUD ---------- */
  api.post(
    "/:collection",
    wrap(async (req, res) => {
      const path = resolveCollection(req, res);
      if (!path) return;
      const body = requireObjectBody(req, res);
      if (!body) return;
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
    const body = requireObjectBody(req, res);
    if (!body) return;
    warnUnmapped(path, body);
    const ok = await repo.replace(path, req.params.id, body);
    if (!ok) {
      res.status(404).json({ error: "not_found", collection: path, id: req.params.id });
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
