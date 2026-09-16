/* =========================================================
   TRANSIENT UI STATE
   -----------------------------------------------------------
   순수 화면 상태만 담는다. 새로고침하면 사라져도 되는 값들이며
   DB/어댑터로 저장되지 않는다. (저장이 필요한 값은
   src/state/settings.js 또는 src/data/store.js 로.)
   ========================================================= */

export const ui = {
  /** 로그인 화면에서 선택한 역할 탭 */
  loginRole: "admin",
  /** 로그인 실패 메시지 */
  loginError: "",

  /** 인력 마스터에서 열려 있는 직원 상세 서랍의 id (null = 닫힘) */
  drawerEmpId: null,
  /** 서랍 안에서 선택된 탭 키 (DRAWER_TABS 참조) */
  drawerTab: "profile",

  /** 인력 마스터 필터 드롭다운 중 열려 있는 것 */
  openFilterDropdown: null, // "division" | "status" | "location" | "recruitType" | "employmentType" | null

  /** 평가 화면의 활성 탭 */
  evalTab: "project", // "project" | "annual" | "regular"

  /** 지원금 마스터에서 상세를 보고 있는 항목 id */
  selectedSubsidyProgramId: null,
};
