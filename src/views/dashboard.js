import { NAV_GROUPS } from "../config/nav.js";
import { LOCATION_OPTIONS, RECRUIT_TYPE_OPTIONS } from "../config/options.js";
import { daysUntil, ddayLabel, esc, fmtDate, fmtWon, initials, todayISO } from "../core/format.js";
import { state } from "../data/store.js";
import { contractEffectiveStatus, contractRenewalDueList, pill, probationStatusOf } from "../domain/hr.js";
import { settings } from "../state/settings.js";
import { ICON } from "../ui/icons.js";
import { probationEvalTargets } from "./probation.js";
export function renderDashboard(){
  const active = state.employees.filter(e=>e.status!=="퇴사");
  const probationers = state.employees.filter(e=> e.status==="수습");
  const subsidyYes = state.employees.filter(e=> e.subsidyEligible && e.subsidyEligible!=="아니오");
  const maternityCount = state.employees.filter(e=>e.status!=="퇴사" && e.workType==="출산휴가").length;
  const childcareCount = state.employees.filter(e=>e.status!=="퇴사" && e.workType==="육아단축근무").length;
  const expiringContracts = state.contracts.filter(c=>{ const d=daysUntil(c.endDate); return c.status!=="완료" && d!==null && d>=0 && d<=30; });

  const deptCounts = {};
  active.forEach(e=>{ const d=e.division||"미지정"; deptCounts[d]=(deptCounts[d]||0)+1; });

  const recruitTypeCounts = {};
  RECRUIT_TYPE_OPTIONS.forEach(o=>recruitTypeCounts[o]=0);
  active.forEach(e=>{ const r=e.recruitType||"정직원"; recruitTypeCounts[r]=(recruitTypeCounts[r]||0)+1; });

  const locationCounts = {};
  LOCATION_OPTIONS.forEach(o=>locationCounts[o]=0);
  active.forEach(e=>{ const l=e.location||"한국"; locationCounts[l]=(locationCounts[l]||0)+1; });

  const upcoming = [...probationers].sort((a,b)=> {
    const da = (a.probation && a.probation.endDate) ? daysUntil(a.probation.endDate) : Infinity;
    const db = (b.probation && b.probation.endDate) ? daysUntil(b.probation.endDate) : Infinity;
    return da - db;
  });
  const upcomingContracts = [...expiringContracts].sort((a,b)=> daysUntil(a.endDate)-daysUntil(b.endDate));

  const probationTargetCount = probationEvalTargets().length;
  const contractTargetCount = contractRenewalDueList().length;
  const subsidyPendingCount = state.subsidyApps.filter(a=>(a.status||"대기")==="대기").length;
  const subsidyYearReceived = (()=>{ const y=String(new Date().getFullYear()); let sum=0; state.subsidyApps.forEach(a=>(a.months||[]).forEach(m=>{ if(m.ym&&m.ym.startsWith(y+"-")&&m.submitted) sum+=Number(m.amount)||0; })); return sum; })();

  return `
    <div class="topbar">
      <div><h1>대시보드</h1><div class="desc">${esc(todayISO()).replaceAll("-",".")} 기준 · 인력 · 평가 · 계약 현황 요약</div></div>
      <div class="topbar-actions"><button class="btn" data-route-to="report">${ICON.doc}인력 현황 보고서 보기 · 이메일 보내기</button></div>
    </div>

    <h2 class="dash-section-h">대시보드 요약</h2>
    <div class="grid kpi-grid">
      ${kpiCard("dashboard","재직 인원", active.length+"명", `전체 등록 ${state.employees.length}명`, "info", {type:"status", value:"ACTIVE"})}
      ${kpiCard("doc","계약 관리 대상 직원", contractTargetCount+"명", "최종 계약일 기준 만 1년 갱신 예정·지연", "warning", null, "contracts")}
      ${kpiCard("coin","정부지원금 대상", subsidyYes.length+"명", "대기·진행중·완료로 지정된 인원", "success", null, "subsidy")}
      ${kpiCard("people","출산·육아 휴가", (maternityCount+childcareCount)+"명", `출산휴가 ${maternityCount}명 · 육아단축 ${childcareCount}명`, "info", null, "leave")}
      ${kpiCard("clock","수습 평가 대상자", probationTargetCount+"명", `${settings.alertDays.probation}일 이내 · 미완료`, "warning", null, "probation")}
      ${kpiCard("coin","지원금 신청 대기", subsidyPendingCount+"건", "상태 = 대기", "warning", null, "subsidy")}
      ${kpiCard("coin",new Date().getFullYear()+"년 지원금 수금액", fmtWon(subsidyYearReceived), "제출 완료 기준 합계", "success", null, "subsidy")}
    </div>

    <h2 class="dash-section-h">직원 계약 정보</h2>
    <div class="panel">
      <div class="panel-head"><h3>사업부별 재직 인원</h3><span class="cell-muted" style="font-size:12px;">합계 ${Object.values(deptCounts).reduce((s,n)=>s+n,0)}명</span></div>
      ${renderStatNumberList(
        Object.entries(deptCounts).sort((a,b)=>b[1]-a[1]).map(([d,c])=>({label:d, value:c, quick:{type:"divisionActive", value:d}})),
        "people", "등록된 재직 인원이 없습니다"
      )}
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr; margin-top:16px;">
      <div class="panel">
        <div class="panel-head"><h3>채용 타입별 인원</h3><span class="cell-muted" style="font-size:12px;">합계 ${Object.values(recruitTypeCounts).reduce((s,n)=>s+n,0)}명</span></div>
        ${renderStatNumberList(
          RECRUIT_TYPE_OPTIONS.map(o=>({label:o, value:recruitTypeCounts[o], quick:{type:"recruitType", value:o}})),
          "people", "등록된 재직 인원이 없습니다"
        )}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>소속 위치별 인원</h3><span class="cell-muted" style="font-size:12px;">합계 ${Object.values(locationCounts).reduce((s,n)=>s+n,0)}명</span></div>
        ${renderStatNumberList(
          LOCATION_OPTIONS.map(o=>({label:o, value:locationCounts[o], quick:{type:"location", value:o}})),
          "people", "등록된 재직 인원이 없습니다"
        )}
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>계약 만료 예정</h3><span class="cell-muted" style="font-size:12px;">합계 ${upcomingContracts.length}건</span></div>
      ${upcomingContracts.length ? `<div class="table-scroll panel-scroll-v"><table><tbody>
        ${upcomingContracts.map(c=>{ const d=daysUntil(c.endDate); const eff=contractEffectiveStatus(c, d);
          return `<tr class="clickable" data-open-emp="${c.employeeId}"><td><div class="cell-strong">${esc(c.employeeName)}</div><div class="meta cell-muted">${esc(c.contractType||"—")}</div></td><td>${pill(eff.label, eff.tone)}</td><td class="cell-muted">종료일 ${fmtDate(c.endDate)} (D-${d})</td></tr>`;
        }).join("")}
      </tbody></table></div>` : emptyState("doc","30일 이내 만료되는 계약이 없습니다")}
    </div>

    <h2 class="dash-section-h">인력 평가 정보</h2>
    <div class="panel">
      <div class="panel-head"><h3>수습 만료 예정</h3><span class="cell-muted" style="font-size:12px;">합계 ${upcoming.length}명</span></div>
      ${upcoming.length ? `<div class="table-scroll panel-scroll-v"><table><tbody>
        ${upcoming.map(e=>{ const st=probationStatusOf(e); const hasEnd = e.probation && e.probation.endDate;
          return `<tr class="clickable" data-open-emp="${e.id}"><td><div class="name-cell"><div class="avatar">${esc(initials(e.name))}</div><div><div class="cell-strong">${esc(e.name)}</div><div class="meta">${esc(e.division||"—")}</div></div></div></td><td>${pill(st.label, st.tone)}</td><td class="cell-muted">${hasEnd?`종료일 ${fmtDate(e.probation.endDate)} (${ddayLabel(e.probation.endDate)})`:"종료일 미등록"}</td></tr>`;
        }).join("")}
      </tbody></table></div>` : emptyState("clock","수습 인력이 없습니다")}
    </div>
  `;
}
export function navLabelOf(routeKey){
  for(const g of NAV_GROUPS){ const it = g.items.find(i=>i.key===routeKey); if(it) return it.label; }
  return "화면";
}
export function kpiCard(icon, label, value, foot, tone, quick, routeTo){
  const attrs = routeTo ? ` data-route-to="${esc(routeTo)}" tabindex="0" role="button" aria-label="${esc(label)} 화면으로 이동"`
    : quick ? ` data-quickfilter="${esc(JSON.stringify(quick))}" tabindex="0" role="button" aria-label="${esc(label)} 인력 목록 보기"` : "";
  const clickable = !!(quick||routeTo);
  return `<div class="card kpi-card ${clickable?"kpi-clickable":""}"${attrs}>
    <div class="top-row"><div class="label">${esc(label)}</div><div class="kpi-icon" style="background:var(--${tone}-soft); color:var(--${tone})">${ICON[icon]}</div></div>
    <div class="value">${esc(value)}</div>
    <div class="foot">${esc(foot)}${clickable?`<br><span class="kpi-link">${routeTo?`${esc(navLabelOf(routeTo))}에서 보기`:"인력 마스터에서 보기"} ${ICON.chevron}</span>`:""}</div>
  </div>`;
}
export function emptyState(icon, text){
  return `<div class="empty-state">${ICON[icon]}<div class="t">${esc(text)}</div></div>`;
}
export function renderStatNumberList(rows, emptyIcon, emptyText){
  if(!rows.length) return emptyState(emptyIcon, emptyText);
  return `<div class="table-scroll"><table>
    <thead><tr><th>구분</th><th class="num">인원</th></tr></thead>
    <tbody>${rows.map(r=>`
      <tr class="clickable" data-quickfilter="${esc(JSON.stringify(r.quick))}" tabindex="0" role="button" aria-label="${esc(r.label)} 인력 목록 보기"><td class="cell-strong">${esc(r.label)}</td><td class="num cell-strong">${r.value}명</td></tr>
    `).join("")}</tbody>
  </table></div>`;
}
