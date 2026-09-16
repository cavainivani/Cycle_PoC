import { esc, fmtDate, fmtWon } from "../core/format.js";
import { state } from "../data/store.js";
import { contractEffectiveStatus, contractRenewalDueList, pill } from "../domain/hr.js";
import { settings } from "../state/settings.js";
import { ICON } from "../ui/icons.js";
import { emptyState, kpiCard } from "./dashboard.js";
export function renderContractsView(){
  const renewalDue = contractRenewalDueList();
  const delayedRenewalCount = renewalDue.filter(({c,d})=> contractEffectiveStatus(c, d).label==="지연").length;
  const completed = [...state.contracts]
    .filter(c=> c.status==="완료" || c.renewalStatus==="완료")
    .sort((a,b)=> (b.startDate||b.endDate||"").localeCompare(a.startDate||a.endDate||""));

  return `
    <div class="topbar">
      <div><h1>계약 관리</h1><div class="desc">전체 직원의 계약·연봉 현황과 히스토리를 관리합니다</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" id="btnAddContract">${ICON.plus}계약 등록</button></div>
    </div>
    <div class="grid kpi-grid">
      ${kpiCard("doc","전체 대상 직원 수", renewalDue.length+"명", "대기 리스트(만료 임박) 기준", "info")}
      ${kpiCard("clock","지연 대상 직원 수", delayedRenewalCount+"명", "갱신 예정일이 이미 지난 인원", delayedRenewalCount>0?"warning":"success")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>대기 리스트</h3><span class="cell-muted" style="font-size:12px;">${renewalDue.length}명 · 최종 계약일 기준 만 1년 시점이 ${settings.alertDays.contract}일 이내이거나 이미 지난 직원</span></div>
      ${renewalDue.length ? `<div class="table-scroll"><table>
        <thead><tr><th>직원</th><th>사업부</th><th>계약구분</th><th>최종 계약일</th><th>갱신 예정일(만 1년)</th><th>D-day</th><th>상태</th><th></th></tr></thead>
        <tbody>${renewalDue.map(({e,c,anniv,d})=>{ const eff=contractEffectiveStatus(c, d); return `
          <tr><td class="cell-strong">${esc(e.name)}</td><td class="cell-muted">${esc(e.division||"—")}</td><td class="cell-muted">${esc(c.contractType||"—")}</td><td class="cell-muted">${fmtDate(e.lastContractDate)}</td><td class="cell-muted">${fmtDate(anniv)}</td><td class="num">${d>=0?`D-${d}`:`D+${-d}`}</td><td>${pill(eff.label, eff.tone)}</td><td><button class="btn btn-sm btn-primary" data-contract-renew="${e.id}" data-contract-old="${c.id}">계약 입력</button></td></tr>
        `;}).join("")}</tbody></table></div>` : emptyState("doc",`만 1년 시점이 ${settings.alertDays.contract}일 이내이거나 지난 갱신 대상 직원이 없습니다`)}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>완료 리스트</h3><span class="cell-muted" style="font-size:12px;">${completed.length}건 · "계약 입력"으로 처리된 완료 상태 계약</span></div>
      ${completed.length ? `<div class="table-scroll"><table>
        <thead><tr><th>직원</th><th>계약구분</th><th>기간</th><th>연봉</th><th>사유</th><th>상태</th></tr></thead>
        <tbody>${completed.map(c=>`
          <tr class="clickable" data-open-emp="${c.employeeId}" data-open-tab="contracts"><td class="cell-strong">${esc(c.employeeName)}</td><td>${esc(c.contractType||"—")}${c.isSample?'<span class="tag-sample">샘플</span>':""}</td><td class="cell-muted">${fmtDate(c.startDate)} ~ ${fmtDate(c.endDate)||"—"}</td><td class="num cell-strong">${fmtWon(c.annualSalary)}</td><td class="cell-muted">${esc(c.changeReason||"—")}</td><td>${pill("완료","success")}</td></tr>
        `).join("")}</tbody></table></div>` : emptyState("doc","완료 처리된 계약이 없습니다")}
    </div>
  `;
}
