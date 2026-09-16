/* =========================================================
   SMOKE TEST
   -----------------------------------------------------------
   로컬에 설치된 Chrome / Edge 를 헤드리스로 띄워 모든 화면을
   한 바퀴 돌며 자바스크립트 오류가 없는지 확인한다.

     npm run build
     npm run preview                     (다른 터미널에서)
     npm run smoke

   다른 주소를 보게 하려면 SMOKE_URL 을 준다:
     SMOKE_URL=http://localhost:8080 npm run smoke   # npm start 로 띄운 서버
     SMOKE_URL=http://localhost:5173 npm run smoke   # npm run dev

   기능을 추가한 뒤 이 스크립트를 돌려 보면, 화면 하나가 조용히
   깨지는 상황을 바로 잡아낼 수 있다.
   ========================================================= */

import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_URL || "http://localhost:4173";
const PASSWORD = process.env.SMOKE_PASSWORD || "0000000000";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const executablePath = process.env.SMOKE_BROWSER || CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error("Chrome/Edge 를 찾지 못했습니다. SMOKE_BROWSER 환경변수로 경로를 지정해 주세요.");
  process.exit(2);
}

const errors = [];
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("[console] " + m.text()); });
page.on("pageerror", (e) => errors.push("[pageerror] " + (e && e.message)));

async function login() {
  await page.waitForFunction(() => {
    const b = document.querySelector("#loginSubmitBtn");
    return b && !b.disabled;
  }, { timeout: 15000 });
  await page.fill("#loginPassword", PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForSelector(".app-shell .nav-item", { timeout: 15000 });
}

await page.goto(BASE, { waitUntil: "networkidle" });
console.log("로그인 게이트 표시       : " + (await page.locator("#loginSubmitBtn").isVisible()));
await login();
console.log("사이드바 재직 인원       : " + (await page.textContent("#sidebarHeadcount")) + "명");

const routes = await page.$$eval("#navList [data-route]", (els) => els.map((e) => e.dataset.route));
console.log("\n[화면 순회] " + routes.length + "개");
for (const r of routes) {
  await page.click(`#navList [data-route="${r}"]`);
  await page.waitForTimeout(350);
  const h1 = ((await page.textContent("#sectionRoot h1").catch(() => "")) || "(제목 없음)").trim();
  const rows = await page.locator("#sectionRoot table tbody tr").count();
  console.log(`  ${r.padEnd(16)} "${h1.slice(0, 30)}"  표 ${rows}행`);
}

console.log("\n[직원 상세 서랍]");
await page.click('#navList [data-route="employees"]');
await page.waitForTimeout(400);
const firstRow = page.locator("#sectionRoot [data-open-emp]").first();
if (await firstRow.count()) {
  await firstRow.click();
  await page.waitForTimeout(500);
  const tabs = await page.$$eval(".drawer-tab", (els) => els.map((e) => e.dataset.dtab));
  for (const t of tabs) {
    await page.click(`.drawer-tab[data-dtab="${t}"]`);
    await page.waitForTimeout(220);
  }
  console.log("  탭 " + tabs.length + "개 모두 렌더: " + tabs.join(", "));
  // 서랍을 열어 둔 채로 두면 인력 마스터가 목록 대신 상세 화면을 그린다. 반드시 닫고 넘어간다.
  await page.click('[data-close-detail="employees"]');
  await page.waitForTimeout(300);
} else {
  console.log("  건너뜀 (직원 데이터 없음)");
}

console.log("\n[인력 현황 보고서]");
await page.click('#navList [data-route="dashboard"]');
await page.waitForTimeout(300);
const reportBtn = page.locator('[data-route-to="report"]').first();
if (await reportBtn.count()) {
  await reportBtn.click();
  await page.waitForTimeout(500);
  console.log("  보고서 렌더: " + ((await page.locator(".report-page").count()) ? "ok" : "실패"));
}

console.log("\n[직원 등록 → 새로고침 후에도 남아 있는지]");
const NEW_NAME = "스모크테스트" + Date.now().toString().slice(-5);
await page.click('#navList [data-route="employees"]');
await page.waitForTimeout(400);
const before = Number(await page.textContent("#sidebarHeadcount"));

await page.click("#btnAddEmployee");
await page.waitForSelector("#f_name", { timeout: 5000 });
await page.fill("#f_name", NEW_NAME);
await page.selectOption("#f_division", "D365");
await page.fill("#f_empNo", "SMOKE-001");
await page.click("#saveNewEmp");
await page.waitForTimeout(700);
const after = Number(await page.textContent("#sidebarHeadcount"));
console.log(`  등록 전 ${before}명 → 등록 후 ${after}명`);

await page.reload({ waitUntil: "networkidle" });
await login();
const afterReload = Number(await page.textContent("#sidebarHeadcount"));
await page.click('#navList [data-route="employees"]');
await page.waitForTimeout(400);
const found = await page.locator(`#sectionRoot td:has-text("${NEW_NAME}")`).count();
console.log(`  새로고침 후 ${afterReload}명, 등록한 직원 조회: ${found ? "찾음" : "없음"}`);
if (afterReload !== after || !found) {
  errors.push("[persistence] 등록한 직원이 새로고침 후 유지되지 않았습니다.");
}

console.log("\n[엑셀 다운로드]");
try {
  // vendor.js 가 동적 import 로 뒤늦게 올라오므로 준비될 때까지 기다린다.
  await page.waitForFunction(() => typeof window.XLSX !== "undefined", { timeout: 20000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.click("#btnExportEmployees"),
  ]);
  console.log("  파일명: " + download.suggestedFilename());
} catch (err) {
  errors.push("[download] 엑셀 다운로드 실패: " + err.message.split("\n")[0]);
  console.log("  실패: " + err.message.split("\n")[0]);
}

await browser.close();

console.log("\n자바스크립트 오류: " + errors.length + "건");
for (const e of errors) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
