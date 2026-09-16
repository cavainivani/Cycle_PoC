/* =========================================================
   db/schema.sql 을 Azure SQL 에 적용한다.
   -----------------------------------------------------------
   사용법:
     # SQL 인증 (로컬 개발 PC — 방화벽에 내 IP 가 열려 있어야 한다)
     SQL_AUTH=sql SQL_USER=mcbsqladmin SQL_PASSWORD='...' node db/apply-schema.mjs

     # Entra 로그인 사용 (az login 된 계정이 SQL 서버의 Entra 관리자여야 한다)
     SQL_AUTH=msi node db/apply-schema.mjs

   스키마는 멱등이다(존재하면 건너뛴다). 여러 번 실행해도 안전하다.
   --------------------------------------------------------- */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, sql } from "../server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 'GO' 한 줄을 배치 구분자로 삼아 나눈다 (sqlcmd 규칙). */
function splitBatches(text) {
  return text
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function main() {
  const file = path.join(__dirname, "schema.sql");
  const text = await readFile(file, "utf8");
  const batches = splitBatches(text);

  console.log(`[schema] ${path.basename(file)} — 배치 ${batches.length}개`);
  const pool = await getPool();

  let applied = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await new sql.Request(pool).batch(batch);
      applied++;
    } catch (err) {
      console.error(`\n[schema] 배치 ${i + 1} 실패:\n${batch.slice(0, 300)}\n`);
      throw err;
    }
  }
  console.log(`[schema] 완료 — ${applied}개 배치 적용`);

  // 결과 확인
  const rows = (
    await pool.request().query(`
      SELECT t.name AS table_name, COUNT(c.column_id) AS columns
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id = t.object_id
      WHERE t.schema_id = SCHEMA_ID('dbo')
      GROUP BY t.name
      ORDER BY t.name
    `)
  ).recordset;

  console.log("\n생성된 테이블:");
  rows.forEach((r) => console.log(`  ${r.table_name.padEnd(30)} 컬럼 ${r.columns}개`));

  await pool.close();
}

main().catch((err) => {
  console.error("[schema] 실패:", err.message);
  process.exit(1);
});
