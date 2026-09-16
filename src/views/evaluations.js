import { daysUntil, ddayLabel, esc, fmtDate, initials } from "../core/format.js";
import { state } from "../data/store.js";
import { gradeFromScore, gradeTone, pill } from "../domain/hr.js";
import { ui } from "../state/ui.js";
import { ICON } from "../ui/icons.js";
import { emptyState } from "./dashboard.js";
export const EVAL_TAB_LABEL = { project:"프로젝트 평가", probation:"수습 평가", annual:"연간 평가", regular:"상시 평가" };
export function renderUpcomingAlertsPanel(opts){
  const showProbation = !opts || opts.showProbation!==false;
  const showContract = !opts || opts.showContract!==false;
  const probDue = state.employees
    .filter(e=> e.status==="수습" && e.probation && e.probation.endDate)
    .map(e=>({e, d:daysUntil(e.probation.endDate)}))
    .filter(x=> x.d!==null && x.d>=0 && x.d<=30)
    .sort((a,b)=>a.d-b.d);
  const contractDue = state.contracts
    .filter(c=> c.status!=="완료" && c.endDate)
    .map(c=>({c, d:daysUntil(c.endDate)}))
    .filter(x=> x.d!==null && x.d>=0 && x.d<=30)
    .sort((a,b)=>a.d-b.d);
  const probPanel = `
      <div class="panel">
        <div class="panel-head"><h3>수습 평가 임박 (30일 이내)</h3><span class="cell-muted" style="font-size:12px;">${probDue.length}명</span></div>
        ${probDue.length ? `<div class="table-scroll panel-scroll-v"><table><tbody>
          ${probDue.map(({e,d})=>`
            <tr class="clickable" data-open-emp="${e.id}" data-open-tab="probation"><td><div class="name-cell"><div class="avatar">${esc(initials(e.name))}</div><div><div class="cell-strong">${esc(e.name)}</div><div class="meta">${esc(e.division||"—")}</div></div></div></td><td class="cell-muted">종료일 ${fmtDate(e.probation.endDate)}</td><td>${pill(ddayLabel(e.probation.endDate), d<=7?"danger":"warning")}</td></tr>
          `).join("")}
        </tbody></table></div>` : emptyState("clock","30일 이내 수습 종료 예정 인원이 없습니다")}
      </div>`;
  const contractPanel = `
      <div class="panel">
        <div class="panel-head"><h3>계약 만료 임박 (30일 이내)</h3><span class="cell-muted" style="font-size:12px;">${contractDue.length}건</span></div>
        ${contractDue.length ? `<div class="table-scroll panel-scroll-v"><table><tbody>
          ${contractDue.map(({c,d})=>`
            <tr class="clickable" data-open-emp="${c.employeeId}" data-open-tab="contracts"><td><div class="cell-strong">${esc(c.employeeName)}</div><div class="meta cell-muted">${esc(c.contractType||"—")}</div></td><td class="cell-muted">종료일 ${fmtDate(c.endDate)}</td><td>${pill(ddayLabel(c.endDate), d<=7?"danger":"warning")}</td></tr>
          `).join("")}
        </tbody></table></div>` : emptyState("doc","30일 이내 계약 만료 예정 건이 없습니다")}
      </div>`;
  if(showProbation && showContract){
    return `<div class="grid" style="grid-template-columns:1fr 1fr; margin-bottom:16px;">${probPanel}${contractPanel}</div>`;
  }
  return `<div class="grid" style="grid-template-columns:1fr; margin-bottom:16px;">${showProbation?probPanel:""}${showContract?contractPanel:""}</div>`;
}
export function renderEvaluations(){
  if(ui.evalTab==="probation") ui.evalTab = "project";
  return `
    <div class="topbar">
      <div><h1>평가 관리</h1><div class="desc">전체 직원의 프로젝트 평가·연간 평가·상시 평가를 한눈에 확인합니다 (수습 평가는 좌측 메뉴의 "수습 관리" 화면에서 관리합니다)</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" id="btnAddEval">${ICON.plus}${EVAL_TAB_LABEL[ui.evalTab]} 등록</button></div>
    </div>
    ${renderUpcomingAlertsPanel()}
    <div class="segmented" style="margin-bottom:16px;">
      <button class="${ui.evalTab==="project"?"active":""}" data-evtab="project">프로젝트 평가</button>
      <button class="${ui.evalTab==="annual"?"active":""}" data-evtab="annual">연간 평가</button>
      <button class="${ui.evalTab==="regular"?"active":""}" data-evtab="regular">상시 평가</button>
    </div>
    <div class="panel">
      ${ui.evalTab==="annual" ? renderAnnualEvalTable() : ui.evalTab==="regular" ? renderRegularEvalTable() : renderProjectEvalTable()}
    </div>
  `;
}
export function renderProjectEvalTable(){
  const rows = [...state.projectEvals].sort((a,b)=>(b.evalDate||"").localeCompare(a.evalDate||""));
  if(!rows.length) return emptyState("star","등록된 프로젝트 평가가 없습니다. 인력 상세에서 등록할 수 있습니다.");
  return `<div class="table-scroll"><table>
    <thead><tr><th>직원</th><th>프로젝트</th><th>역할</th><th>기간</th><th>점수</th><th>등급</th><th>평가자</th><th>평가일</th></tr></thead>
    <tbody>${rows.map(ev=>`
      <tr class="clickable" data-open-emp="${ev.employeeId}" data-open-tab="projectEval"><td class="cell-strong">${esc(ev.employeeName)}</td><td>${esc(ev.projectName)}${ev.isSample?'<span class="tag-sample">샘플</span>':""}</td><td class="cell-muted">${esc(ev.role||"—")}</td><td class="cell-muted">${esc(ev.period||"—")}</td><td class="num">${esc(ev.score)}점</td><td>${pill(gradeFromScore(ev.score), gradeTone(gradeFromScore(ev.score)))}</td><td class="cell-muted">${esc(ev.evaluator||"—")}</td><td class="cell-muted">${fmtDate(ev.evalDate)}</td></tr>
    `).join("")}</tbody></table></div>`;
}
export function renderAnnualEvalTable(){
  const rows = [...state.annualEvals].sort((a,b)=>(b.year||0)-(a.year||0));
  if(!rows.length) return emptyState("star","등록된 연간 평가가 없습니다. 인력 상세에서 등록할 수 있습니다.");
  return `<div class="table-scroll"><table>
    <thead><tr><th>직원</th><th>연도</th><th>등급</th><th>점수</th><th>평가자</th><th>평가일</th><th>승진 의견</th><th>코멘트</th></tr></thead>
    <tbody>${rows.map(ev=>`
      <tr class="clickable" data-open-emp="${ev.employeeId}" data-open-tab="annualEval"><td class="cell-strong">${esc(ev.employeeName)}</td><td>${esc(ev.year)}</td><td>${pill(ev.grade, gradeTone(ev.grade))}</td><td class="num">${esc(ev.score)}점</td><td class="cell-muted">${esc(ev.evaluator||"—")}</td><td class="cell-muted">${fmtDate(ev.evalDate)}</td><td class="cell-muted">${esc((ev.promotionOpinion||"—").slice(0,30))}</td><td class="cell-muted">${esc((ev.comment||"—").slice(0,40))}</td></tr>
    `).join("")}</tbody></table></div>`;
}
export function renderRegularEvalTable(){
  const rows = [...state.regularEvals].sort((a,b)=>(b.evalDate||"").localeCompare(a.evalDate||""));
  if(!rows.length) return emptyState("star","등록된 상시 평가가 없습니다. 인력 상세 또는 상단의 등록 버튼으로 무기명으로 등록할 수 있습니다.");
  return `<div class="table-scroll"><table>
    <thead><tr><th>직원</th><th>평가일</th><th>등급</th><th>항목 요약</th><th>코멘트</th><th></th></tr></thead>
    <tbody>${rows.map(ev=>`
      <tr><td class="cell-strong">${esc(ev.employeeName)}</td><td class="cell-muted">${fmtDate(ev.evalDate)}</td><td>${ev.grade?pill(ev.grade, gradeTone(ev.grade)):"—"}</td><td class="cell-muted">${(ev.items||[]).map(it=>`${esc(it.key)}(${esc(it.grade)})`).join(" · ")||"—"}</td><td class="cell-muted">${esc((ev.comment||"—").slice(0,40))}</td><td><span class="pill pill-muted">무기명</span></td></tr>
    `).join("")}</tbody></table></div>`;
}
export function probationOpinionTone(op){
  return (op==="정직원 채용" || op==="정규직 전환 권고") ? "success" : op ? "danger" : "muted";
}
