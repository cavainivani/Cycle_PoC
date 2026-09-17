/* =========================================================
   LOCAL ADAPTER  (기본값 · DB 없음)
   -----------------------------------------------------------
   브라우저 localStorage 에 전부 저장한다. 서버도 DB도 필요 없고,
   새로고침해도 입력한 내용이 남으므로 "클릭해서 돌아가는 초안"에
   딱 맞는다.

   - 데이터는 브라우저별로 따로 저장된다 (다른 PC와 공유되지 않음).
   - 처음 열면 src/data/seed.js 의 예시 데이터가 자동으로 채워진다.
   - localStorage 를 못 쓰는 환경(사생활 보호 모드 등)에서는
     메모리에만 유지된다 — 화면은 정상 동작하고 새로고침 시 초기화된다.
   ========================================================= */

import { COLLECTION_PATHS } from "../schema.js";
import { buildSeedData } from "../seed.js";

const STORAGE_KEY = "mcb-hr-ops/v1";
const SETTINGS_KEY = "mcb-hr-ops/settings/v1";
/** 초안 모드의 초기 암호. src/state/settings.js 의 기본값과 같다. */
const DEFAULT_LOCAL_PASSWORD = "0000000000";

function safeRead(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}
function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // 용량 초과 / 접근 차단 — 메모리 사본만으로 계속 동작시킨다.
    return false;
  }
}

export function createLocalAdapter() {
  /** @type {Record<string, Map<string, object>>} */
  const tables = {};
  COLLECTION_PATHS.forEach((p) => { tables[p] = new Map(); });
  let seq = 1;
  let settingsDoc = null;
  /** 로그인한 역할 (메모리에만 — 새로고침하면 풀린다) */
  let localRole = null;

  function persist() {
    const dump = {};
    COLLECTION_PATHS.forEach((p) => { dump[p] = [...tables[p].values()]; });
    safeWrite(STORAGE_KEY, { seq, tables: dump });
  }

  function hydrate() {
    const saved = safeRead(STORAGE_KEY);
    if (saved && saved.tables) {
      seq = Number(saved.seq) || 1;
      COLLECTION_PATHS.forEach((p) => {
        (saved.tables[p] || []).forEach((rec) => {
          if (rec && rec.id) tables[p].set(rec.id, rec);
        });
      });
      return "restored";
    }
    // 최초 실행 — 예시 데이터를 채운다.
    const seed = buildSeedData();
    COLLECTION_PATHS.forEach((p) => {
      (seed[p] || []).forEach((rec) => tables[p].set(rec.id, rec));
    });
    persist();
    return "seeded";
  }

  const origin = hydrate();
  settingsDoc = safeRead(SETTINGS_KEY);

  return {
    name: "local",
    /** "seeded" = 예시 데이터로 시작, "restored" = 저장해 둔 내용 복원 */
    origin,

    async load() {
      const out = {};
      COLLECTION_PATHS.forEach((p) => {
        out[p] = [...tables[p].values()].sort((a, b) => (a._ord || 0) - (b._ord || 0));
      });
      return out;
    },

    async add(path, data) {
      const id = "local-" + (seq++);
      tables[path].set(id, { ...data, id, _ord: seq });
      persist();
      return id;
    },

    async set(path, id, data) {
      tables[path].set(id, { ...data, id });
      persist();
    },

    async update(path, id, merged) {
      tables[path].set(id, { ...merged, id });
      persist();
    },

    async remove(path, id) {
      tables[path].delete(id);
      persist();
    },

    async readSettings() {
      return settingsDoc;
    },

    async writeSettings(doc) {
      settingsDoc = doc;
      safeWrite(SETTINGS_KEY, doc);
    },

    /* ---------- 인증 ----------
       DB 도 서버도 없는 모드라, 예전처럼 브라우저 안에서 비교한다.
       이건 보안 장치가 아니라 초안을 클릭해 보기 위한 화면 잠금이다.
       실제 인증은 rest 어댑터(서버 검사 + 세션 쿠키)에만 있다. */

    async login(role, password) {
      const key = role === "admin" ? "adminPassword" : "pmoPassword";
      const expected = (settingsDoc && settingsDoc[key]) || DEFAULT_LOCAL_PASSWORD;
      if (password && password === expected) {
        localRole = role;
        return role;
      }
      return null;
    },
    async logout() {
      localRole = null;
    },
    async session() {
      // 새로고침하면 메모리가 비므로 항상 로그아웃 상태다 (기존 동작과 같다).
      return localRole;
    },
    async setPassword(role, newPassword) {
      const key = role === "admin" ? "adminPassword" : "pmoPassword";
      settingsDoc = { ...(settingsDoc || {}), [key]: newPassword };
      safeWrite(SETTINGS_KEY, settingsDoc);
    },

    /** 저장된 내용을 전부 지우고 예시 데이터로 되돌린다. */
    async reset() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SETTINGS_KEY);
      } catch (err) { /* 무시 */ }
      COLLECTION_PATHS.forEach((p) => tables[p].clear());
      seq = 1;
      settingsDoc = null;
      hydrate();
    },
  };
}
