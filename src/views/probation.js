import { daysUntil, esc, fmtDate } from "../core/format.js";
import { state } from "../data/store.js";
import { pill, probationStatusOf } from "../domain/hr.js";
import { settings } from "../state/settings.js";
import { emptyState, kpiCard } from "./dashboard.js";
export function probationWaitingList(){
  return state.employees.filter(e=> e.probation && e.probation.startDate && (!e.probation.finalDecision || e.probation.finalDecision==="대기" || e.probation.finalDecision==="지연"));
}
export function probationEvalTargets(){
  return state.employees
    .filter(e=> e.status==="수습" && e.probation && e.probation.startDate && (!e.probation.finalDecision || e.probation.finalDecision==="대기" || e.probation.finalDecision==="지연"))
    .map(e=>({e, d:daysUntil(e.probation.endDate)}))
    .filter(x=> x.d!==null && x.d>=0 && x.d<=settings.alertDays.probation)
    .sort((a,b)=>a.d-b.d);
}
export function renderProbationView(){
  const trackedEmp = state.employees.filter(e=> e.probation && e.probation.startDate);
  const inProgress = probationWaitingList()
    .sort((a,b)=>{
      const da = daysUntil(a.probation.endDate), db = daysUntil(b.probation.endDate);
      return (da===null?Infinity:da) - (db===null?Infinity:db);
    });
  const delayedProbationCount = inProgress.filter(e=> probationStatusOf(e).label==="지연").length;
  const completed = trackedEmp
    .filter(e=> e.probation.finalDecision==="합격" || e.probation.finalDecision==="불합격")
    .sort((a,b)=> (b.probation.finalDecisionDate||"").localeCompare(a.probation.finalDecisionDate||""));

  return `
    <div class="topbar">
      <div><h1>수습 관리</h1><div class="desc">수습 대상 전체 인원의 진행·완료 현황을 관리합니다</div></div>
    </div>
    <div class="grid kpi-grid">
      ${kpiCard("clock","전체 대상 직원 수", inProgress.length+"명", "대기 리스트 기준", "info")}
      ${kpiCard("clock","지연 대상 직원 수", delayedProbationCount+"명", "수습 평가가 지연된 인원", delayedProbationCount>0?"warning":"success")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>대기 리스트</h3><span class="cell-muted" style="font-size:12px;">${inProgress.length}명</span></div>
      ${inProgress.length ? `<div class="table-scroll"><table>
        <thead><tr><th>직원</th><th>사업부</th><th>시작일</th><th>종료일</th><th>D-day</th><th>진행 상태</th><th></th></tr></thead>
        <tbody>${inProgress.map(e=>{ const st=probationStatusOf(e); const d = daysUntil(e.probation.endDate); return `
          <tr><td class="cell-strong">${esc(e.name)}</td><td class="cell-muted">${esc(e.division||"—")}</td><td class="cell-muted">${fmtDate(e.probation.startDate)}</td><td class="cell-muted">${fmtDate(e.probation.endDate)}</td><td class="num">${d!==null?(d>=0?`D-${d}`:`D+${-d}`):"—"}</td><td>${pill(st.label, st.tone)}</td><td><button class="btn btn-sm btn-primary" data-probation-eval="${e.id}">평가 하기</button></td></tr>
        `;}).join("")}</tbody></table></div>` : emptyState("clock","대기 중인 수습 대상자가 없습니다")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>완료 리스트</h3><span class="cell-muted" style="font-size:12px;">${completed.length}명</span></div>
      ${completed.length ? `<div class="table-scroll"><table>
        <thead><tr><th>직원</th><th>사업부</th><th>시작일</th><th>종료일</th><th>최종 판정</th><th>판정일</th><th></th></tr></thead>
        <tbody>${completed.map(e=>{ const fd=e.probation.finalDecision; const tone= fd==="합격"?"success":fd==="불합격"?"danger":"info"; return `
          <tr><td class="cell-strong">${esc(e.name)}</td><td class="cell-muted">${esc(e.division||"—")}</td><td class="cell-muted">${fmtDate(e.probation.startDate)}</td><td class="cell-muted">${fmtDate(e.probation.endDate)}</td><td>${pill(fd, tone)}</td><td class="cell-muted">${fmtDate(e.probation.finalDecisionDate)}</td><td><button class="btn btn-sm" data-probation-view="${e.id}">평가 보기</button></td></tr>
        `;}).join("")}</tbody></table></div>` : emptyState("star","완료된 수습 평가가 없습니다")}
    </div>
  `;
}
