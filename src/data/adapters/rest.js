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

     GET    /api/collections            -> { employees:[...], contracts:[...], ... }
     POST   /api/:collection            -> { id }        (본문: 레코드)
     PUT    /api/:collection/:id        -> 204           (본문: 레코드 전체)
     PATCH  /api/:collection/:id        -> 204           (본문: 병합된 레코드 전체)
     DELETE /api/:collection/:id        -> 204
     GET    /api/settings               -> 설정 문서 또는 null
     PUT    /api/settings               -> 204
   ========================================================= */

const BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || "/api";

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
    async reset() {
      throw new Error("REST 어댑터에서는 초기화를 지원하지 않습니다.");
    },
  };
}
