import { SUBSIDY_STATUS_OPTIONS, subsidyEmpStatusTone, subsidyStatusTone } from "../config/options.js";
import { addMonths, byId, esc, fmtDate, fmtWon, fmtYm, monthsBetween } from "../core/format.js";
import { setRoute } from "../core/router.js";
import { dbAdd, dbUpdate, state } from "../data/store.js";
import { empById, pill, syncEmployeeSubsidyStatus } from "../domain/hr.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { emptyState, kpiCard } from "./dashboard.js";
export function renderSubsidyRows(list, empOnlyList){
  const appRows = list.map(a=>{
      const sumReceived = (a.months||[]).filter(m=>m.submitted).reduce((s,m)=>s+(Number(m.amount)||0),0);
      const pct = a.totalAmount ? Math.min(100, Math.round(sumReceived/a.totalAmount*100)) : 0;
      const st = a.status||"대기";
      return `
      <tr><td class="cell-strong">${esc(a.employeeName)}${a.isSample?'<span class="tag-sample">샘플</span>':""}</td><td class="cell-muted">${esc(a.program||"—")}</td><td class="cell-muted">${fmtDate(a.periodStart)} ~ ${fmtDate(a.periodEnd)}</td><td class="num">${fmtWon(a.totalAmount)}</td><td class="num">${fmtWon(sumReceived)}</td><td class="num">${pct}%</td><td>${pill(st, subsidyStatusTone(st))}</td><td style="white-space:nowrap;"><button class="btn btn-sm" data-open-subsidy="${a.id}">상세 보기</button><button class="icon-btn" data-del-app="${a.id}">${ICON.trash}</button></td></tr>
      `;
    }).join("");
  // 인력 마스터에서 지원금 대상자 상태만 지정되고 아직 신청 건이 등록되지 않은 직원 -- 목록에는
  // 노출하되(사용자 요청: 대상자 상태에 따라 대기/진행/완료 리스트에 표시), 신청 데이터가 없으므로
  // 항목·기간·금액 칸은 빈 값으로 두고 "신청 등록" 버튼으로 실제 신청 건 등록을 유도한다.
  const empRows = (empOnlyList||[]).map(e=>{
      return `<tr><td class="cell-strong">${esc(e.name)}${e.isSample?'<span class="tag-sample">샘플</span>':""}</td><td class="cell-muted">—</td><td class="cell-muted">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td>${pill(e.subsidyEligible, subsidyEmpStatusTone(e.subsidyEligible))}</td><td style="white-space:nowrap;"><button class="btn btn-sm" data-open-subsidy-emp="${e.id}">신청 등록</button></td></tr>`;
    }).join("");
  return `<div class="table-scroll"><table>
    <thead><tr><th>직원</th><th>지원 항목</th><th>기간</th><th>총 신청액</th><th>수령액</th><th>진행률</th><th>상태</th><th></th></tr></thead>
    <tbody>${appRows}${empRows}</tbody></table></div>`;
}
// Shared by renderSubsidyView() (대기/진행/완료 리스트 + KPI 카드) and navCountFor("subsidyTargets")
// (사이드바 "지원금 관리" 메뉴 숫자 = 대기 대상 인원 + 진행 대상 인원) so both always agree on the
// same target-employee counts, including employees who only have a 인력마스터 상태 지정(신청 미등록).
export function subsidySectionData(){
  const all = [...state.subsidyApps];
  const appEmpIds = new Set(all.map(a=>a.employeeId));
  const pending = all.filter(a=> (a.status||"대기")==="대기").sort((a,b)=> (b.periodStart||"").localeCompare(a.periodStart||""));
  const inProgress = all.filter(a=> a.status==="진행").sort((a,b)=> (b.periodStart||"").localeCompare(a.periodStart||""));
  const completed = all.filter(a=> a.status==="완료").sort((a,b)=> (b.periodEnd||b.periodStart||"").localeCompare(a.periodEnd||a.periodStart||""));
  // 인력 마스터 지원금 대상자 상태는 지정되어 있지만 아직 신청 건이 없는 직원 -- 상태별로 나눠
  // 각 리스트에 함께 노출한다(신청 건이 이미 있는 직원은 위 app 목록에 이미 반영되어 중복 노출하지 않음).
  const pendingEmpOnly = state.employees.filter(e=> e.subsidyEligible==="대기" && !appEmpIds.has(e.id));
  const inProgressEmpOnly = state.employees.filter(e=> e.subsidyEligible==="진행중" && !appEmpIds.has(e.id));
  const completedEmpOnly = state.employees.filter(e=> e.subsidyEligible==="완료" && !appEmpIds.has(e.id));
  const pendingTargetCount = new Set(pending.map(a=>a.employeeId)).size + pendingEmpOnly.length;
  const inProgressTargetCount = new Set(inProgress.map(a=>a.employeeId)).size + inProgressEmpOnly.length;
  return { pending, inProgress, completed, pendingEmpOnly, inProgressEmpOnly, completedEmpOnly, pendingTargetCount, inProgressTargetCount };
}
export function renderSubsidyView(){
  const { pending, inProgress, completed, pendingEmpOnly, inProgressEmpOnly, completedEmpOnly, pendingTargetCount, inProgressTargetCount } = subsidySectionData();

  return `
    <div class="topbar">
      <div><h1>지원금 관리</h1><div class="desc">신청 대상자와 항목·기간·전체 금액을 등록하고 월별 지급 현황을 관리합니다</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" id="btnAddSubsidyApp">${ICON.plus}신청 등록</button></div>
    </div>
    <div class="grid kpi-grid">
      ${kpiCard("coin","대기 대상 인원", pendingTargetCount+"명", "대기 리스트 대상 인원", "warning")}
      ${kpiCard("coin","진행 대상 인원", inProgressTargetCount+"명", "진행 리스트 대상 인원", "info")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>대기 리스트</h3><span class="cell-muted" style="font-size:12px;">${pending.length+pendingEmpOnly.length}건</span></div>
      ${(pending.length||pendingEmpOnly.length) ? renderSubsidyRows(pending, pendingEmpOnly) : emptyState("coin","대기 중인 정부지원금 신청이 없습니다")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>진행 리스트</h3><span class="cell-muted" style="font-size:12px;">${inProgress.length+inProgressEmpOnly.length}건</span></div>
      ${(inProgress.length||inProgressEmpOnly.length) ? renderSubsidyRows(inProgress, inProgressEmpOnly) : emptyState("coin","진행 중인 정부지원금 신청이 없습니다")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>완료 리스트</h3><span class="cell-muted" style="font-size:12px;">${completed.length+completedEmpOnly.length}건</span></div>
      ${(completed.length||completedEmpOnly.length) ? renderSubsidyRows(completed, completedEmpOnly) : emptyState("coin","완료된 정부지원금 신청이 없습니다")}
    </div>
  `;
}
export function renderSubsidyAppDetailBody(a){
  const months = a.months || [];
  const sumReceived = months.filter(m=>m.submitted).reduce((s,m)=>s+(Number(m.amount)||0),0);
  const submittedCount = months.filter(m=>m.submitted).length;
  const pct = a.totalAmount ? Math.min(100, Math.round(sumReceived/a.totalAmount*100)) : 0;
  const st = a.status||"대기";
  return `
    <div class="cell-muted" style="font-size:12px; margin-bottom:14px;">${fmtDate(a.periodStart)} ~ ${fmtDate(a.periodEnd)}</div>
    <div class="field" style="max-width:220px; margin-bottom:16px;">
      <label>진행 상태</label>
      <select id="sa_status_${a.id}" data-status-app="${a.id}">${SUBSIDY_STATUS_OPTIONS.map(s=>`<option ${st===s?"selected":""}>${s}</option>`).join("")}</select>
    </div>
    <div class="stat-mini-grid" style="margin-bottom:18px;">
      <div class="stat-mini"><div class="v">${esc(a.paymentType||"월별")}</div><div class="l">지급 방식</div></div>
      <div class="stat-mini"><div class="v">${fmtWon(a.totalAmount)}</div><div class="l">전체 신청 금액</div></div>
      <div class="stat-mini"><div class="v">${a.monthlyAmount?fmtWon(a.monthlyAmount):"—"}</div><div class="l">월별 신청금액</div></div>
      <div class="stat-mini"><div class="v">${fmtWon(sumReceived)}</div><div class="l">누적 수령액</div></div>
      <div class="stat-mini"><div class="v">${submittedCount}/${months.length}</div><div class="l">제출 완료 개월</div></div>
      <div class="stat-mini"><div class="v">${pct}%</div><div class="l">수령 진행률</div></div>
    </div>
    ${months.length ? `<div class="table-scroll"><table>
      <thead><tr><th>월</th><th>지원 항목(청구 사항)</th><th>제출 여부</th><th>지원 금액(만원)</th></tr></thead>
      <tbody>${months.map((m,i)=>`
        <tr>
          <td class="cell-strong">${esc(fmtYm(m.ym))}</td>
          <td><input class="cell-input month-item" data-mi="${i}" value="${esc(m.item||"")}"></td>
          <td><label class="switch"><input type="checkbox" class="month-submitted" data-mi="${i}" ${m.submitted?"checked":""}><span class="slider"></span></label></td>
          <td><input type="number" class="cell-input num month-amount" data-mi="${i}" value="${esc(m.amount??0)}"></td>
        </tr>
      `).join("")}</tbody>
    </table></div>` : emptyState("clock","신청 기간이 설정되지 않아 월별 항목이 없습니다. 신청 정보 수정에서 기간을 입력해 주세요.")}
    <div style="margin-top:14px; text-align:right;"><button class="btn btn-primary" data-save-months="${a.id}">월별 내역 저장</button></div>
    ${a.notes?`<div class="cell-muted" style="margin-top:14px; font-size:12.5px;"><b>비고</b> ${esc(a.notes)}</div>`:""}
  `;
}
export function openSubsidyDetailModal(a){
  openModal(`${a.employeeName} · ${a.program||"—"}`, renderSubsidyAppDetailBody(a),
    `<button class="btn" data-cancel>닫기</button><button class="btn" id="modalEditSubsidyApp">${ICON.edit}신청 정보 수정</button>`);
  const root = byId("overlayRoot");
  root.querySelector("[data-cancel]").onclick = closeOverlay;
  const editBtn = byId("modalEditSubsidyApp");
  if(editBtn) editBtn.onclick = ()=>{ closeOverlay(); openSubsidyAppModal(a, null, "subsidy"); };
  root.querySelectorAll("[data-status-app]").forEach(sel=> sel.onchange = async ()=>{
    const appId = sel.dataset.statusApp;
    await dbUpdate("subsidy_applications", appId, {status:sel.value});
    await syncEmployeeSubsidyStatus(a.employeeId, appId, sel.value);
    toast("진행 상태가 저장되었습니다.");
    closeOverlay();
  });
  const saveMonthsBtn = root.querySelector("[data-save-months]");
  if(saveMonthsBtn) saveMonthsBtn.onclick = async ()=>{
    const appId = saveMonthsBtn.dataset.saveMonths;
    const app = state.subsidyApps.find(x=>x.id===appId); if(!app) return;
    const months = (app.months||[]).map((m,i)=>({
      ym: m.ym,
      item: (root.querySelector(`.month-item[data-mi="${i}"]`)||{value:m.item||""}).value.trim(),
      submitted: (root.querySelector(`.month-submitted[data-mi="${i}"]`)||{checked:!!m.submitted}).checked,
      amount: Number((root.querySelector(`.month-amount[data-mi="${i}"]`)||{value:m.amount||0}).value)||0,
    }));
    await dbUpdate("subsidy_applications", appId, {months});
    toast("월별 지급 내역이 저장되었습니다.");
    closeOverlay();
  };
}
export function openSubsidyAppModal(existing, presetEmployee, returnTo){
  returnTo = returnTo || "subsidy";
  const fixedEmp = existing ? empById(existing.employeeId) : presetEmployee;
  const eligibleEmployees = state.employees.filter(e=> e.subsidyEligible && e.subsidyEligible!=="아니오");
  const empList = (fixedEmp && !eligibleEmployees.some(e=>e.id===fixedEmp.id)) ? [...eligibleEmployees, fixedEmp] : eligibleEmployees;
  const empOptions = empList.map(e=>`<option value="${esc(e.id)}" ${fixedEmp&&fixedEmp.id===e.id?"selected":""}>${esc(e.name)} · ${esc(e.division||"사업부 미정")}</option>`).join("");
  const programOptions = state.subsidyPrograms.map(p=>`<option value="${esc(p.id)}" ${existing&&existing.programId===p.id?"selected":""}>${esc(p.name)}</option>`).join("");
  if(!state.subsidyPrograms.length){ toast("먼저 설정 > 지원금 마스터에서 지원금 항목을 등록해 주세요."); return; }
  if(!fixedEmp && !eligibleEmployees.length){ toast("인력 마스터에서 지원금 대상자가 지정된 직원이 없습니다. 먼저 인력 마스터에서 대상 직원의 지원금 대상자를 \"대기\" 등으로 지정해 주세요."); return; }
  openModal(existing?"신청 정보 수정":"정부지원금 신청 등록", `
    <div class="form-grid">
      <div class="field span2"><label>대상 직원 *</label><select id="sa_emp" ${fixedEmp?"disabled":""}>${fixedEmp?"":'<option value="">직원 선택</option>'}${empOptions}</select><div class="hint">인력 마스터에서 지원금 대상자가 "아니오"가 아닌 직원만 표시됩니다.</div></div>
      <div class="field span2"><label>지원금 항목 *</label><select id="sa_program"><option value="">항목 선택 (설정 &gt; 지원금 마스터에 등록된 항목)</option>${programOptions}</select></div>
      <div class="field"><label>진행 상태</label><select id="sa_status">${SUBSIDY_STATUS_OPTIONS.map(s=>`<option ${(existing?existing.status:"대기")===s?"selected":""}>${s}</option>`).join("")}</select></div>
      <div class="field"><label>지급 방식</label><select id="sa_paymentType">
        <option value="월별" ${(!existing||existing.paymentType!=="1회성")?"selected":""}>월별</option>
        <option value="1회성" ${existing&&existing.paymentType==="1회성"?"selected":""}>1회성</option>
      </select></div>
      <div class="field"><label>지원 기간 시작</label><input type="date" id="sa_start" value="${esc((existing&&existing.periodStart)||"")}"></div>
      <div class="field"><label>지원 기간 종료</label><input type="date" id="sa_end" value="${esc((existing&&existing.periodEnd)||"")}"></div>
      <div class="field" id="sa_months_wrap"><label>개월 수</label><input type="number" min="1" id="sa_months" value="${esc((existing&&existing.monthsCount)||"")}"></div>
      <div class="field"><label>월별 신청금액(만원)</label><input type="number" id="sa_monthly" value="${esc((existing&&existing.monthlyAmount)??"")}"></div>
      <div class="field span2"><label>전체 신청 금액(만원)</label><input type="number" id="sa_total" value="${esc((existing&&existing.totalAmount)??"")}"></div>
      <div class="field span2"><label>비고</label><textarea id="sa_notes" rows="2">${esc((existing&&existing.notes)||"")}</textarea></div>
    </div>
    <div class="field hint" style="margin-top:8px;">직원과 지원금 항목의 조합으로 신청 건이 식별됩니다 (동일 조합 중복 등록 불가). "월별"을 선택하면 개월 수·월별 신청금액을 입력할 수 있고, 기간을 입력하면 오른쪽 화면에 월별 청구 항목이 자동으로 생성됩니다. "1회성"을 선택하면 전체 신청 금액을 한 번에 청구하는 건으로 등록됩니다.</div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveSubsidyApp">${existing?"저장":"등록"}</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  const programSel = byId("sa_program");
  programSel.addEventListener("change", ()=>{
    const match = state.subsidyPrograms.find(p=>p.id===programSel.value);
    if(!match) return;
    const totalEl = byId("sa_total");
    if(totalEl && !totalEl.value && match.amount) totalEl.value = match.amount;
    const startEl = byId("sa_start"), endEl = byId("sa_end");
    if(startEl && startEl.value && endEl && !endEl.value && match.months) endEl.value = addMonths(startEl.value, match.months);
    const monthsEl = byId("sa_months");
    if(monthsEl && !monthsEl.value && match.months) monthsEl.value = match.months;
  });
  const paymentTypeSel = byId("sa_paymentType");
  const monthsWrap = byId("sa_months_wrap");
  function syncPaymentTypeUI(){ monthsWrap.style.display = paymentTypeSel.value==="월별" ? "" : "none"; }
  paymentTypeSel.addEventListener("change", syncPaymentTypeUI);
  syncPaymentTypeUI();
  const monthsEl = byId("sa_months");
  monthsEl.addEventListener("change", ()=>{
    const startEl = byId("sa_start"), endEl = byId("sa_end");
    const n = Number(monthsEl.value)||0;
    if(paymentTypeSel.value==="월별" && n>0 && startEl.value) endEl.value = addMonths(startEl.value, n);
  });
  byId("saveSubsidyApp").onclick = async ()=>{
    const empId = fixedEmp ? fixedEmp.id : byId("sa_emp").value;
    const emp = empById(empId);
    if(!emp){ toast("대상 직원을 선택해 주세요."); return; }
    const programId = programSel.value;
    const programObj = state.subsidyPrograms.find(p=>p.id===programId);
    if(!programObj){ toast("지원금 항목을 선택해 주세요."); return; }
    if(!existing && state.subsidyApps.some(a=> a.employeeId===emp.id && a.programId===programId)){
      toast("이미 해당 직원·항목 조합으로 등록된 신청 건이 있습니다. 왼쪽 목록에서 선택해 수정해 주세요.");
      return;
    }
    const program = programObj.name;
    const status = byId("sa_status").value;
    const paymentType = byId("sa_paymentType").value;
    const periodStart = byId("sa_start").value;
    let periodEnd = byId("sa_end").value;
    const monthsCount = Number(byId("sa_months").value)||0;
    const monthlyAmount = Number(byId("sa_monthly").value)||0;
    let totalAmount = Number(byId("sa_total").value)||0;
    const notes = byId("sa_notes").value.trim();
    if(paymentType==="월별" && monthsCount>0 && periodStart && !periodEnd){
      periodEnd = addMonths(periodStart, monthsCount);
    }
    if(!totalAmount && paymentType==="월별" && monthlyAmount && monthsCount){
      totalAmount = monthlyAmount*monthsCount;
    }
    let months;
    if(paymentType==="1회성"){
      months = periodStart ? [{ym:periodStart.slice(0,7), item:program, submitted:false, amount: totalAmount||monthlyAmount}] : [];
    } else {
      const ymList = monthsBetween(periodStart, periodEnd);
      const perMonthDefault = monthlyAmount || (ymList.length ? Math.round(totalAmount/ymList.length) : 0);
      if(existing){
        const oldByYm = {}; (existing.months||[]).forEach(m=> oldByYm[m.ym]=m);
        months = ymList.map(ym=> oldByYm[ym] ? oldByYm[ym] : {ym, item:program, submitted:false, amount:perMonthDefault});
      } else {
        months = ymList.map(ym=>({ym, item:program, submitted:false, amount:perMonthDefault}));
      }
    }
    const payload = {employeeId:emp.id, employeeName:emp.name, programId, program, status, paymentType, monthsCount:monthsCount||months.length, monthlyAmount, periodStart, periodEnd, totalAmount, notes, months};
    if(existing){
      await dbUpdate("subsidy_applications", existing.id, payload);
      await syncEmployeeSubsidyStatus(emp.id, existing.id, status);
    } else {
      const newId = await dbAdd("subsidy_applications", payload);
      await syncEmployeeSubsidyStatus(emp.id, newId, status);
    }
    closeOverlay();
    toast(existing ? "신청 정보가 저장되었습니다." : "정부지원금 신청이 등록되었습니다.");
    setRoute("subsidy");
  };
}
