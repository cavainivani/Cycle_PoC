/* =========================================================
   REST ADAPTER  (아직 쓰지 않음 · 실제 연동용 골격)
   -----------------------------------------------------------
   나중에 진짜 DB를 붙일 때 여기만 채우면 화면 코드는 한 줄도
   바꿀 필요가 없다. 사용 방법:

     1) server/index.js 의 /api 라우터에 실제 엔드포인트 구현
     2) .env 에  VITE_DATA_SOURCE=rest  설정
     3) 끝. (src/data/store.js 가 알아서 이 어댑터를 고른다)

   기대하는 서버 API 형태 — src/data/schema.js 의 컬렉션 경로가
   그대로 URL 세그먼트가 된다:

     POST   /api/login                  -> { role }      (본문: {role, password})
     POST   /api/logout                 -> 204
     GET    /api/session                -> { role } 또는 null
     GET    /api/collections            -> { employees:[...], contracts:[...], ... }
     POST   /api/:collection            -> { id }        (본문: 레코드)
     PUT    /api/:collection/:id        -> 204           (본문: 레코드 전체)
     PATCH  /api/:collection/:id        -> 204           (본문: 병합된 레코드 전체)
     DELETE /api/:collection/:id        -> 204
     GET    /api/settings               -> 설정 문서 또는 null (암호는 들어있지 않다)
     PUT    /api/settings               -> 204
     POST   /api/password               -> 204           (본문: {role, newPassword})

   로그인 전에는 /api/collections 등이 401 을 돌려준다. 세션은 HttpOnly
   쿠키라 자바스크립트로는 읽을 수 없고, 같은 출처 요청에 자동으로 붙는다.
   ========================================================= */

const BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || "/api";

/** 401 을 만나면 화면이 로그인 상태를 되돌릴 수 있게 구분 가능한 오류를 던진다. */
export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "UnauthorizedError";
  }
}

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    // 세션 쿠키를 반드시 함께 보낸다 (같은 출처라 기본값도 동일하지만 명시한다).
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(`${method} ${BASE}${path} 실패 (${res.status})`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function createRestAdapter() {
  return {
    name: "rest",
    origin: "remote",

    async load() {
      return (await request("GET", "/collections")) || {};
    },
    async add(path, data) {
      const out = await request("POST", `/${path}`, data);
      return (out && out.id) || null;
    },
    async set(path, id, data) {
      await request("PUT", `/${path}/${encodeURIComponent(id)}`, data);
    },
    async update(path, id, merged) {
      await request("PATCH", `/${path}/${encodeURIComponent(id)}`, merged);
    },
    async remove(path, id) {
      await request("DELETE", `/${path}/${encodeURIComponent(id)}`);
    },
    async readSettings() {
      return await request("GET", "/settings");
    },
    async writeSettings(doc) {
      await request("PUT", "/settings", doc);
    },

    /* ---------- 인증 ----------
       암호 검사는 서버가 한다. 브라우저는 암호 정답을 알지 못한다. */

    async login(role, password) {
      try {
        const out = await request("POST", "/login", { role, password });
        return (out && out.role) || null;
      } catch (err) {
        if (err instanceof UnauthorizedError) return null; // 암호 불일치
        throw err;
      }
    },
    async logout() {
      await request("POST", "/logout");
    },
    async session() {
      const out = await request("GET", "/session");
      return (out && out.role) || null;
    },
    async setPassword(role, newPassword) {
      await request("POST", "/password", { role, newPassword });
    },

    async reset() {
      throw new Error("REST 어댑터에서는 초기화를 지원하지 않습니다.");
    },
  };
}
