import { SUBSIDY_APP_STATUS_TO_EMP_FIELD, SUBSIDY_EMP_STATUS_RANK } from "../config/options.js";
import { addMonths, daysUntil, esc } from "../core/format.js";
import { dbUpdate, rawState, state } from "../data/store.js";
import { settings } from "../state/settings.js";
export function empById(id){ return state.employees.find(e=>e.id===id); }
export function empLabel(e){ return e ? `${e.name} · ${e.division||"사업부 미정"}` : "—"; }
export function contractedEmployees(){ return state.employees.filter(e=> e.status!=="퇴사" && state.contracts.some(c=>c.employeeId===e.id)); }
export function contractRenewalDueList(){
  // Renewal basis is the employee master's "최종 계약일" (lastContractDate) field, not the
  // matched contract document's own startDate -- the two are usually kept in sync when a
  // renewal is processed, but lastContractDate is the authoritative source for this calc.
  const latestByEmp = contractedEmployees().map(e=>{
    const cs = state.contracts.filter(c=>c.employeeId===e.id);
    const latest = [...cs].sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""))[0];
    return {e, c:latest};
  });
  return latestByEmp
    .filter(({e})=> e.lastContractDate)
    .map(({e,c})=>{
      const anniv = addMonths(e.lastContractDate, 12);
      return {e, c, anniv, d:daysUntil(anniv)};
    })
    .filter(({d})=> d!==null && d<=settings.alertDays.contract)
    .sort((a,b)=> a.d-b.d);
}
// Recomputes the employee master's "지원금 대상자" status from that employee's subsidy
// applications, and writes it back if it changed. overrideAppId/overrideStatus reflect an
// in-flight change before the db snapshot refreshes (overrideStatus===null means that
// application was just deleted). When an employee has multiple applications, the
// most-advanced status wins: 완료 > 진행중 > 대기.
export function bestSubsidyEmpStatus(apps){
  let best = null;
  apps.forEach(a=>{
    const mapped = SUBSIDY_APP_STATUS_TO_EMP_FIELD[a.status||"대기"] || "대기";
    if(!best || SUBSIDY_EMP_STATUS_RANK[mapped] > SUBSIDY_EMP_STATUS_RANK[best]) best = mapped;
  });
  return best;
}
export async function syncEmployeeSubsidyStatus(employeeId, overrideAppId, overrideStatus){
  let apps = (rawState.subsidyApps||[]).filter(a=>a.employeeId===employeeId);
  if(overrideAppId){
    if(overrideStatus===null){
      apps = apps.filter(a=>a.id!==overrideAppId);
    } else if(overrideStatus!==undefined){
      const exists = apps.some(a=>a.id===overrideAppId);
      apps = exists ? apps.map(a=> a.id===overrideAppId ? {...a, status:overrideStatus} : a) : [...apps, {id:overrideAppId, status:overrideStatus}];
    }
  }
  if(!apps.length) return;
  const best = bestSubsidyEmpStatus(apps);
  const emp = rawState.employees.find(e=>e.id===employeeId);
  if(emp && best && emp.subsidyEligible !== best){
    await dbUpdate("employees", employeeId, {subsidyEligible: best});
  }
}

/* status helpers */
export function statusPill(status){
  const map = { "수습":"warning", "근무":"success", "퇴사":"muted" };
  return `<span class="pill pill-${map[status]||"muted"}"><span class="pill-dot"></span>${esc(status||"—")}</span>`;
}
export function isOnLeave(e){ return e.workType==="출산휴가" || e.workType==="육아단축근무" || e.workType==="기타"; }
export function workTypePill(workType){
  const wt = workType || "일반근무";
  const map = { "일반근무":"muted", "출산휴가":"info", "육아단축근무":"info", "기타":"warning" };
  return `<span class="pill pill-${map[wt]||"muted"}"><span class="pill-dot"></span>${esc(wt)}</span>`;
}
export function leaveProgramLabel(e){
  if(!e || !e.leaveProgramId) return "";
  const p = state.subsidyPrograms.find(x=>x.id===e.leaveProgramId);
  return p ? p.name : "";
}
export function probationStatusOf(emp){
  const p = emp.probation || {};
  if(p.finalDecision==="합격") return {label:"합격", tone:"success"};
  if(p.finalDecision==="불합격") return {label:"불합격", tone:"danger"};
  if(emp.status !== "수습"){
    return {label:"대상 아님", tone:"muted"};
  }
  if(!p.startDate) return {label:"대기", tone:"muted"};
  const d = daysUntil(p.endDate);
  if(p.finalDecision==="지연" || (d!==null && d<0)) return {label:"지연", tone:"warning"};
  return {label:"대기"+(d!==null?` (D-${d})`:""), tone:"info"};
}
export function contractEffectiveStatus(c, dOverride){
  if(c.status==="완료") return {label:"완료", tone:"success"};
  if(c.status==="지연") return {label:"지연", tone:"warning"};
  if(typeof dOverride==="number" && dOverride<0) return {label:"지연", tone:"warning"};
  return {label:"대기", tone:"info"};
}
export function pill(label, tone){ return `<span class="pill pill-${tone}"><span class="pill-dot"></span>${esc(label)}</span>`; }
export function gradeFromScore(score){
  score = Number(score)||0;
  if(score>=90) return "우수"; if(score>=75) return "양호"; if(score>=60) return "보통"; return "미흡";
}
export function gradeTone(g){ return {"우수":"success","양호":"info","보통":"warning","미흡":"danger","S":"success","A":"success","B":"info","C":"warning","D":"danger"}[g]||"muted"; }
