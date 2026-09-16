import { NAV_GROUPS, PMO_MENU_SUFFIX_ROUTES, PMO_RESTRICTED_ROUTES } from "../config/nav.js";
import { bindSectionEvents } from "./bindings.js";
import { byId, esc } from "./format.js";
import { clearSampleData, state, storeStatus } from "../data/store.js";
import { contractRenewalDueList, isOnLeave } from "../domain/hr.js";
import { authState } from "../state/settings.js";
import { ICON } from "../ui/icons.js";
import { confirmDialog, toast } from "../ui/overlay.js";
import { renderContractsView } from "../views/contracts.js";
import { renderDashboard } from "../views/dashboard.js";
import { renderEmployees } from "../views/employees.js";
import { renderEvaluations } from "../views/evaluations.js";
import { renderHrReport } from "../views/hr-report.js";
import { renderLeaveView } from "../views/leave.js";
import { probationWaitingList, renderProbationView } from "../views/probation.js";
import { renderSubsidyProgramsView } from "../views/subsidy-programs.js";
import { renderSubsidyView, subsidySectionData } from "../views/subsidy.js";
import { renderSystemSettingsView } from "../views/system-settings.js";
export let route = "dashboard";
export function setRoute(r){
  if(authState.role==="pmo" && PMO_RESTRICTED_ROUTES.includes(r)){
    toast("PMO 계정은 접근할 수 없는 화면입니다.");
    r = "dashboard";
  }
  route = r; renderNav(); renderRoute();
}
export function navCountFor(countKey){
  if(countKey==="employees") return state.employees.filter(e=> e.status!=="퇴사").length;
  if(countKey==="probationTargets") return probationWaitingList().length;
  if(countKey==="contractTargets") return contractRenewalDueList().length;
  if(countKey==="subsidyTargets"){
    const { pendingTargetCount, inProgressTargetCount } = subsidySectionData();
    return pendingTargetCount + inProgressTargetCount;
  }
  if(countKey==="leaveTargets") return state.employees.filter(e=> e.status!=="퇴사" && isOnLeave(e)).length;
  return (state[countKey]||[]).length;
}
export function renderNav(){
  const html = NAV_GROUPS.map(g=>{
    const items = authState.role==="pmo" ? g.items.filter(it=> !PMO_RESTRICTED_ROUTES.includes(it.key)) : g.items;
    if(!items.length) return "";
    return `
    <div class="nav-label">${esc(g.label)}</div>
    ${items.map(it=>`
      <button class="nav-item ${route===it.key?"active":""}" data-route="${it.key}">
        ${ICON[it.icon]}<span>${esc(it.label)}${(authState.role==="pmo" && PMO_MENU_SUFFIX_ROUTES.includes(it.key))?" (PMO)":""}</span>
        ${it.countKey?`<span class="count">${navCountFor(it.countKey)}</span>`:""}
      </button>`).join("")}
  `;
  }).join("");
  byId("navList").innerHTML = html;
  byId("navList").querySelectorAll("[data-route]").forEach(b=>{
    b.onclick = ()=> setRoute(b.dataset.route);
  });
}
export function updateSidebarCounts(){
  byId("sidebarHeadcount").textContent = state.employees.filter(e=>e.status!=="퇴사").length;
  const roleLabel = byId("sidebarRoleLabel");
  if(roleLabel) roleLabel.textContent = authState.role==="admin" ? "관리자 (admin)" : authState.role==="pmo" ? "PMO" : "";
  renderNav();
}
export function renderDbBanner(){
  byId("dbBannerSlot").innerHTML = storeStatus.error
    ? `<div class="db-banner">데이터 저장소에 문제가 발생했습니다 (${esc(storeStatus.error)}). 화면은 계속 사용할 수 있지만 변경 내용이 저장되지 않을 수 있습니다.</div>`
    : "";
}
export function renderSampleBanner(){
  const anySample = Object.values(state).some(arr=>arr.some(d=>d.isSample));
  byId("sampleBannerSlot").innerHTML = anySample ? `
    <div class="sample-banner">
      <span>${ICON.doc}</span>
      <span><strong>샘플 데이터</strong>가 포함되어 있습니다. 실제 운영 전에 정리해 주세요.</span>
      <span class="spacer"></span>
      <button class="btn btn-sm" id="clearSampleBtn">샘플 데이터 정리</button>
    </div>` : "";
  const btn = byId("clearSampleBtn");
  if(btn) btn.onclick = async ()=>{ const ok = await confirmDialog("샘플 데이터 정리", "isSample로 표시된 모든 예시 데이터를 삭제합니다. 계속할까요?"); if(ok) clearSampleData(); };
}

export function renderRoute(){
  renderDbBanner();
  renderSampleBanner();
  const root = byId("sectionRoot");
  const renderers = {
    dashboard: renderDashboard, employees: renderEmployees,
    evaluations: renderEvaluations, contracts: renderContractsView, probation: renderProbationView, subsidy: renderSubsidyView,
    leave: renderLeaveView,
    subsidyPrograms: renderSubsidyProgramsView,
    systemSettings: renderSystemSettingsView,
    report: renderHrReport,
  };
  root.innerHTML = `<div class="section">${(renderers[route]||renderDashboard)()}</div>`;
  bindSectionEvents();
  updateSidebarCounts();
}
