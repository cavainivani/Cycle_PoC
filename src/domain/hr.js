import { SUBSIDY_APP_STATUS_TO_EMP_FIELD, SUBSIDY_EMP_STATUS_RANK } from "../config/options.js";
import { addMonths, daysUntil, esc, todayISO } from "../core/format.js";
import { dbUpdate, rawState, state } from "../data/store.js";
import { latestContractOf, pickLatestContract, renewalDateOf } from "./employee-helpers.js";
import { settings } from "../state/settings.js";
export function empById(id){ return state.employees.find(e=>e.id===id); }
export function empLabel(e){ return e ? `${e.name} · ${e.division||"사업부 미정"}` : "—"; }
export function contractedEmployees(){ return state.employees.filter(e=> e.status!=="퇴사" && state.contracts.some(c=>c.employeeId===e.id)); }
/**
 * 재계약이 임박했거나 지난 직원 목록.
 *
 * ★ 기준은 계약 문서다.
 *   예전에는 직원 마스터의 lastContractDate 를 기준으로 삼았는데, 그 값을
 *   채우는 경로가 "계약 입력"(갱신) 하나뿐이라 서랍에서 "계약 등록" 으로
 *   넣은 계약은 이 화면에 영영 나타나지 않았다. 이제 계약이 단일 원천이고
 *   직원의 lastContractDate 는 거기서 파생되는 표시용 값이다
 *   (syncEmployeeContractFields 참고).
 */
export function contractRenewalDueList(){
  return contractedEmployees()
    .map(e=>{
      const c = latestContractOf(e.id);
      const anniv = renewalDateOf(c);
      return {e, c, anniv, d: daysUntil(anniv)};
    })
    .filter(({c,anniv,d})=> c && anniv && d!==null && d<=settings.alertDays.contract)
    .sort((a,b)=> a.d-b.d);
}

/**
 * 직원 마스터의 "현재 연봉 · 최종 계약일" 을 계약에서 다시 계산한다.
 * 계약을 등록·삭제한 뒤에 부른다.
 *
 * 두 필드는 계약에서 파생되는 값이다. 직접 입력하게 두면 계약과 갈라진다 —
 * 실제로 "계약은 있는데 직원 연봉이 0", "직원 연봉은 있는데 계약이 없음" 이
 * 동시에 생겼었다.
 */
export async function syncEmployeeContractFields(employeeId){
  const emp = (rawState.employees||[]).find(e=>e.id===employeeId);
  if(!emp) return;
  // 화면(state)이 아니라 rawState 를 본다 — 사업부 제한이 걸려 있어도 정확해야 한다.
  const latest = pickLatestContract((rawState.contracts||[]).filter(c=>c.employeeId===employeeId));
  const next = {
    lastContractDate: latest ? (latest.startDate||"") : "",
    currentSalary: latest ? (Number(latest.annualSalary)||0) : 0,
  };
  const sameDate = (emp.lastContractDate||"") === next.lastContractDate;
  const sameSalary = (Number(emp.currentSalary)||0) === next.currentSalary;
  if(sameDate && sameSalary) return;
  await dbUpdate("employees", employeeId, next);
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

/** 수습 기간 (개월). 서랍의 "수습 시작" 버튼과 탭 이름("수습평가(3개월)")이 쓰는 값과 같아야 한다. */
export const PROBATION_MONTHS = 3;

/**
 * 재직상태를 "수습" 으로 두면 수습 정보를 채워 준다.
 *
 * 수습 관리 화면은 probation.startDate 가 있어야 대상으로 잡는다
 * (probationWaitingList). 그런데 인력 마스터에서 재직상태만 "수습" 으로
 * 고르면 probation 이 빈 객체라, 화면에는 "수습" 이라고 보이는데 수습
 * 관리에는 나타나지 않았다.
 *
 * 이미 시작한 수습(startDate 가 있음)은 건드리지 않는다 — 나중에 상태를
 * 다시 "수습" 으로 바꿔도 원래 시작일과 평가 이력이 유지되어야 한다.
 */
export function ensureProbationInfo(data){
  if(!data || data.status !== "수습") return data;
  const p = data.probation || {};
  if(p.startDate) return data;
  const start = data.workStartDate || data.hireDate || todayISO();
  return {
    ...data,
    probation: {
      ...p,
      startDate: start,
      endDate: addMonths(start, PROBATION_MONTHS),
      finalDecision: p.finalDecision || "대기",
      evaluations: p.evaluations || [],
    },
  };
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
