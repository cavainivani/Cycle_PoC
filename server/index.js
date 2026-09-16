/* =========================================================
   STATIC SERVER  (Azure App Service · Node)
   -----------------------------------------------------------
   Vite 가 만든 dist/ 를 그대로 서빙한다. 지금은 DB 연동이 없으므로
   서버가 하는 일은 정적 파일 전달뿐이고, 나중에 실제 API 를 붙일
   자리는 아래 /api 라우터에 표시해 두었다.

   로컬 확인:  npm run build && npm start   ->  http://localhost:8080
   Azure:      시작 명령(Startup Command)을  node server/index.js
   ========================================================= */

import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8080;

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "2mb" }));

/* ---------------------------------------------------------
   헬스체크 — Azure 의 상태 확인용
   --------------------------------------------------------- */
app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "mcb-hr-ops", time: new Date().toISOString() });
});

/* ---------------------------------------------------------
   API 자리표시자
   -----------------------------------------------------------
   현재 화면은 브라우저 localStorage 만 사용하므로 이 라우터는
   호출되지 않는다. 실제 DB 를 붙일 때:

     1) 아래 TODO 위치에 엔드포인트를 구현하고
        (기대하는 형태는 src/data/adapters/rest.js 주석 참고)
     2) 앱 설정에 VITE_DATA_SOURCE=rest 를 넣고 다시 빌드한다.

   그 전까지는 501 을 돌려주어, 잘못 연결했을 때 조용히 실패하지
   않고 바로 드러나게 한다.
   --------------------------------------------------------- */
const api = express.Router();

// TODO: 실제 데이터 소스 연동 지점
//   GET    /collections
//   POST   /:collection
//   PUT    /:collection/:id
//   PATCH  /:collection/:id
//   DELETE /:collection/:id
//   GET    /settings
//   PUT    /settings
api.use((req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "아직 서버 데이터 API가 구현되지 않았습니다. server/index.js 의 /api 라우터를 채워 주세요.",
    path: req.path,
    method: req.method,
  });
});

app.use("/api", api);

/* ---------------------------------------------------------
   정적 파일
   --------------------------------------------------------- */
if (!existsSync(DIST)) {
  console.warn("[server] dist/ 가 없습니다. 먼저 `npm run build` 를 실행해 주세요.");
}

// 파일명에 내용 해시가 붙는 assets/ 는 1년 캐시해도 안전하다.
app.use(
  "/assets",
  express.static(path.join(DIST, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// 나머지(index.html, favicon 등)는 매번 최신 여부를 확인하게 한다.
app.use(express.static(DIST, { maxAge: 0, etag: true }));

// SPA 폴백 — 알 수 없는 경로는 index.html 로 넘긴다.
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[server] 인재 라이프사이클 허브 · http://localhost:${PORT}`);
});
