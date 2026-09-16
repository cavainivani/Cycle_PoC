/* =========================================================
   APP SERVER  (Azure App Service · Node)
   -----------------------------------------------------------
   두 가지를 한다.
     1) Vite 가 만든 dist/ 를 서빙한다.
     2) /api 아래에 Azure SQL 을 읽고 쓰는 데이터 API 를 연다.
        (server/api.js · server/repository.js · db/schema.sql)

   로컬 확인:  npm run build && npm start   ->  http://localhost:8080
   Azure:      컨테이너 CMD 가  node server/index.js
   ========================================================= */

import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createApiRouter } from "./api.js";

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
   데이터 API  (Azure SQL)
   -----------------------------------------------------------
   구현은 server/api.js 에 있고, 테이블 매핑은 server/collections.js,
   스키마는 db/schema.sql 이다.

   화면이 이 API 를 실제로 쓰게 하려면 빌드 시점에
   VITE_DATA_SOURCE=rest 가 설정되어 있어야 한다 (.env.example 참고).
   기본값 local 로 빌드하면 화면은 여전히 localStorage 를 쓰고
   이 라우터는 호출되지 않는다.
   --------------------------------------------------------- */
app.use("/api", createApiRouter());

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
