/* =========================================================
   AUTH  (암호 해시 · 세션 쿠키 · 접근 제어)
   -----------------------------------------------------------
   이전 구조에서는 브라우저가 서버에서 암호를 받아와 스스로 비교했다.
   그래서 (1) 암호가 로그인 전에 이미 브라우저에 있었고, (2) 로그인을
   거치지 않고 /api 를 직접 불러도 데이터가 그대로 나왔다.

   여기서 두 가지를 바꾼다.
     - 암호 검사를 서버가 한다. 암호는 브라우저로 나가지 않는다.
     - /api 는 세션 쿠키가 없으면 401 이다. (server/api.js 에서 적용)

   의존성을 늘리지 않으려고 Node 내장 crypto 만 쓴다.
     해시   scrypt (bcrypt 대신 — 내장이고 메모리 하드하다)
     세션   HMAC-SHA256 으로 서명한 무상태 쿠키 (세션 저장소 불필요)
   ========================================================= */

import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** 설정이 저장된 적 없을 때 쓰는 초기 암호. src/state/settings.js 와 같은 값. */
export const DEFAULT_SYSTEM_PASSWORD = "0000000000";

/** 세션 유효 기간 */
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const COOKIE_NAME = "mcb_session";

const KEY_LEN = 32;
const SALT_LEN = 16;

/* ---------------------------------------------------------
   세션 서명 키
   ---------------------------------------------------------
   앱 설정(SESSION_SECRET)에서 읽는다. 없으면 임시로 만들어 쓰되,
   재시작마다 값이 바뀌어 전원 로그아웃되므로 경고를 남긴다.
   --------------------------------------------------------- */
const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (fromEnv) {
    console.warn("[auth] SESSION_SECRET 이 너무 짧습니다(32자 이상 권장). 그대로 사용합니다.");
    return fromEnv;
  }
  console.warn("[auth] SESSION_SECRET 이 없어 임시 키를 생성했습니다 — 재시작하면 모두 로그아웃됩니다.");
  return randomBytes(32).toString("hex");
})();

/* ---------------------------------------------------------
   암호 해시
   --------------------------------------------------------- */

/** 평문 암호 -> "scrypt:<salt>:<key>" 저장 문자열 */
export async function hashPassword(plain) {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(String(plain), salt, KEY_LEN);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * 평문과 저장된 해시를 비교한다.
 * 저장 형식이 아니면(예: 예전 평문 값) false — 되돌아가지 않도록 일부러 막는다.
 */
export async function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  let saltHex, keyHex;
  [, saltHex, keyHex] = parts;
  let expected;
  try {
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;

  const actual = await scryptAsync(String(plain), Buffer.from(saltHex, "hex"), KEY_LEN);
  return timingSafeEqual(actual, expected);
}

/** 길이가 달라도 타이밍이 새지 않게 비교 (기본 암호 경로용) */
export function safeEqualString(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // 길이가 다르면 확실히 다르지만, 그래도 한 번은 비교해 타이밍을 맞춘다.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/* ---------------------------------------------------------
   세션 쿠키 (무상태 · HMAC 서명)
   --------------------------------------------------------- */

function sign(payloadB64) {
  return createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
}

function makeToken(role) {
  const payload = { role, exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

/** 토큰이 유효하면 { role, exp }, 아니면 null */
export function readToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = sign(b64);
  // 서명 비교는 길이가 같으므로 timingSafeEqual 을 그대로 쓴다.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || !payload.role || !payload.exp) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}

/** Cookie 헤더를 직접 파싱한다 (cookie-parser 의존성을 늘리지 않으려고). */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function setSessionCookie(res, role) {
  const token = makeToken(role);
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",                       // 자바스크립트에서 못 읽는다
    "SameSite=Lax",                   // 다른 사이트에서 넘어온 요청에는 안 붙는다
    `Max-Age=${SESSION_HOURS * 3600}`,
  ];
  // App Service 는 HTTPS 를 강제하므로 Secure 를 붙인다.
  // 로컬(http://localhost) 개발에서는 붙이면 쿠키가 저장되지 않는다.
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** 요청에 실린 세션 (없거나 만료면 null) */
export function sessionOf(req) {
  return readToken(readCookie(req, COOKIE_NAME));
}

/* ---------------------------------------------------------
   미들웨어
   --------------------------------------------------------- */

/** 로그인해야 통과 */
export function requireAuth(req, res, next) {
  const session = sessionOf(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "로그인이 필요합니다." });
    return;
  }
  req.session = session;
  next();
}

/**
 * 관리자만 통과.
 * 시스템 설정(암호 변경·노출 사업부·알림 기준일)은 관리자 전용 화면이다
 * (src/config/nav.js 의 PMO_RESTRICTED_ROUTES).
 */
export function requireAdmin(req, res, next) {
  const session = sessionOf(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "로그인이 필요합니다." });
    return;
  }
  if (session.role !== "admin") {
    res.status(403).json({ error: "forbidden", message: "관리자만 할 수 있습니다." });
    return;
  }
  req.session = session;
  next();
}
