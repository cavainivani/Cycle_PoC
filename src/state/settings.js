/* =========================================================
   SETTINGS / AUTH STATE
   -----------------------------------------------------------
   Values here are persisted through the data adapter (see
   src/data/settings-store.js). They are exported as *objects*
   so other modules can both read and mutate them -- ES module
   bindings themselves are read-only for importers.
   ========================================================= */

export const DEFAULT_SYSTEM_PASSWORD = "0000000000";
export const DEFAULT_ALERT_DAYS = { probation: 30, contract: 30 };

export const settings = {
  /** 로그인 암호 (역할별). 프로토타입 단계의 단순 비교용 — 실제 인증으로 교체 대상. */
  passwords: { admin: DEFAULT_SYSTEM_PASSWORD, pmo: DEFAULT_SYSTEM_PASSWORD },
  /** 역할별 노출 사업부. 빈 배열 = 전체 공개, 값이 있으면 그 사업부만 보임. */
  visibleDivisions: { admin: [], pmo: [] },
  /** 알림 기준일(전역). 수습 평가 / 계약 갱신 대상자 집계에 쓰임. */
  alertDays: { probation: DEFAULT_ALERT_DAYS.probation, contract: DEFAULT_ALERT_DAYS.contract },
  /** 설정 로딩 완료 여부 — 완료 전에는 로그인 폼이 비활성화된다. */
  ready: false,
};

/** 현재 로그인 세션. role: "admin" | "pmo" | null */
export const authState = { loggedIn: false, role: null };
