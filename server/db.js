/* =========================================================
   DB LAYER  (Azure SQL)
   -----------------------------------------------------------
   연결 풀 · 타입 변환 · 재시도를 담당한다. SQL 문장 자체는
   server/repository.js 가 만든다.

   인증 방식 (SQL_AUTH)
     msi  관리 ID  — App Service 에서 기본값. 비밀번호가 없다.
     sql  SQL 인증 — 로컬 개발용. SQL_USER / SQL_PASSWORD 필요.

   ★ 서버리스 자동 일시중지
     이 DB 는 GP_S_Gen5(서버리스)이고 60분 유휴 시 정지한다.
     정지 상태에서 들어온 첫 연결은 재개(30~60초)를 기다리지 못하고
     실패한다. 그래서 연결/쿼리 실패 시 지수 백오프로 재시도한다.
     재시도로 가려지지 않는 근본 해결은 자동 일시중지를 끄는 것이다.
   ========================================================= */

import sql from "mssql";
import { randomUUID } from "node:crypto";

const SERVER = process.env.SQL_SERVER || "mcb-hr-management.database.windows.net";
const DATABASE = process.env.SQL_DATABASE || "MCB-HR-Management-DB";
const AUTH = (process.env.SQL_AUTH || (process.env.SQL_PASSWORD ? "sql" : "msi")).toLowerCase();

/** 재개(resume) 대기를 포함한 재시도 설정 */
const MAX_ATTEMPTS = Number(process.env.SQL_MAX_ATTEMPTS || 5);
const BASE_DELAY_MS = Number(process.env.SQL_RETRY_BASE_MS || 1500);

function buildConfig() {
  const base = {
    server: SERVER,
    database: DATABASE,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      // DATE/DATETIME2 를 UTC 기준으로 주고받는다. 아래 toDateParam /
      // fromDateValue 가 이 전제 위에서 동작하므로 바꾸지 말 것.
      useUTC: true,
      // 서버리스 재개를 기다릴 수 있도록 넉넉히 잡는다.
      connectTimeout: 60000,
      requestTimeout: 60000,
    },
    pool: {
      max: Number(process.env.SQL_POOL_MAX || 10),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (AUTH === "sql") {
    const user = process.env.SQL_USER;
    const password = process.env.SQL_PASSWORD;
    if (!user || !password) {
      throw new Error("SQL_AUTH=sql 인데 SQL_USER / SQL_PASSWORD 가 없습니다.");
    }
    return { ...base, user, password };
  }

  // 관리 ID (App Service 시스템 할당 ID). 비밀번호 없음.
  return {
    ...base,
    authentication: { type: "azure-active-directory-default" },
  };
}

/* ---------------------------------------------------------
   연결 풀 — 실패하면 버리고 다시 만든다
   --------------------------------------------------------- */

let poolPromise = null;

export async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .then((pool) => {
        pool.on("error", (err) => {
          console.error("[db] 풀 오류 — 다음 요청에서 재연결합니다:", err.message);
          poolPromise = null;
        });
        console.log(`[db] 연결됨 (${AUTH === "sql" ? "SQL 인증" : "관리 ID"}) ${SERVER}/${DATABASE}`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null; // 다음 호출에서 다시 시도할 수 있게 비운다
        throw err;
      });
  }
  return poolPromise;
}

/** 연결이 끊겼을 때 나는 오류인지 — 재시도해 볼 가치가 있는지 판단 */
function isTransient(err) {
  const code = err && (err.code || (err.originalError && err.originalError.code));
  const msg = ((err && err.message) || "").toLowerCase();
  return (
    code === "ETIMEOUT" ||
    code === "ESOCKET" ||
    code === "ECONNCLOSED" ||
    code === "ECONNRESET" ||
    code === "ELOGIN" ||
    code === "ENOTOPEN" ||
    msg.includes("is not currently available") || // 서버리스 재개 중
    msg.includes("resuming") ||
    msg.includes("timeout") ||
    msg.includes("connection is closed")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 일시적 오류면 지수 백오프로 다시 시도한다.
 * 서버리스가 자고 있을 때 첫 요청이 살아나는 경로가 여기다.
 */
export async function withRetry(fn, label = "query") {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      poolPromise = null; // 끊긴 풀은 버린다
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[db] ${label} 실패(${attempt}/${MAX_ATTEMPTS}) — ${delay}ms 후 재시도: ${err.message}`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/* ---------------------------------------------------------
   타입 변환  (JS 문서 <-> SQL 컬럼)
   --------------------------------------------------------- */

/** 새 레코드 id. 화면은 id 를 불투명한 문자열로만 다룬다. */
export function newId() {
  return randomUUID();
}

function isBlank(v) {
  return v === undefined || v === null || v === "";
}

/** 'YYYY-MM-DD' -> UTC 자정 Date. useUTC:true 전제. */
function toDateParam(v) {
  if (isBlank(v)) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** DATE 컬럼 값 -> 'YYYY-MM-DD'. useUTC:true 전제라 UTC 기준으로 읽는다. */
function fromDateValue(v) {
  if (v == null) return null;
  if (!(v instanceof Date)) return String(v).slice(0, 10);
  if (isNaN(v.getTime())) return null;
  const y = v.getUTCFullYear();
  const m = String(v.getUTCMonth() + 1).padStart(2, "0");
  const d = String(v.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toNumberParam(v) {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 컬럼 정의(type)에 맞는 mssql 타입과 값을 돌려준다. */
export function toParam(type, value) {
  switch (type) {
    case "date":
      return { sqlType: sql.Date, value: toDateParam(value) };
    case "int": {
      const n = toNumberParam(value);
      return { sqlType: sql.Int, value: n === null ? null : Math.round(n) };
    }
    case "decimal":
      return { sqlType: sql.Decimal(14, 2), value: toNumberParam(value) };
    case "bit":
      return { sqlType: sql.Bit, value: isBlank(value) ? 0 : value ? 1 : 0 };
    case "json":
      return {
        sqlType: sql.NVarChar(sql.MAX),
        value: value === undefined || value === null ? null : JSON.stringify(value),
      };
    case "datetime": {
      if (isBlank(value)) return { sqlType: sql.DateTime2, value: null };
      const d = value instanceof Date ? value : new Date(value);
      return { sqlType: sql.DateTime2, value: isNaN(d.getTime()) ? null : d };
    }
    case "text":
    default:
      return {
        sqlType: sql.NVarChar(sql.MAX),
        value: value === undefined || value === null ? null : String(value),
      };
  }
}

/** SQL 에서 읽은 값을 화면이 기대하는 JS 값으로 되돌린다. */
export function fromColumn(type, value) {
  switch (type) {
    case "date":
      return fromDateValue(value);
    case "int":
    case "decimal":
      return value == null ? null : Number(value);
    case "bit":
      return value == null ? false : Boolean(value);
    case "json":
      if (value == null) return null;
      try {
        return JSON.parse(value);
      } catch {
        console.warn("[db] JSON 파싱 실패 — null 로 대체합니다.");
        return null;
      }
    case "datetime":
      if (value == null) return null;
      return value instanceof Date ? value.toISOString() : String(value);
    case "text":
    default:
      return value == null ? null : String(value);
  }
}

export { sql };
