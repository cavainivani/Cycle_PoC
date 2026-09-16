import { byId, daysUntil, esc, fmtDate, initials, todayISO } from "../core/format.js";
import { renderRoute } from "../core/router.js";
import { dbUpdate, state } from "../data/store.js";
import { empById, isOnLeave, leaveProgramLabel, pill, workTypePill } from "../domain/hr.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { emptyState, kpiCard } from "./dashboard.js";
export function renderLeaveView(){
  const onLeave = state.employees
    .filter(e=> e.status!=="퇴사" && isOnLeave(e))
    .sort((a,b)=>{
      const da = daysUntil(a.leaveExpectedReturnDate), db = daysUntil(b.leaveExpectedReturnDate);
      return (da===null?Infinity:da) - (db===null?Infinity:db);
    });
  const maternityCount = onLeave.filter(e=>e.workType==="출산휴가").length;
  const childcareCount = onLeave.filter(e=>e.workType==="육아단축근무").length;
  const overdue = onLeave.filter(e=>{ const d=daysUntil(e.leaveExpectedReturnDate); return d!==null && d<0; }).length;

  return `
    <div class="topbar">
      <div><h1>휴가자 관리</h1><div class="desc">육아휴직·출산휴가 등 휴가 중인 인력의 현황과 복귀 예정일을 관리합니다</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" id="btnAddLeave">${ICON.plus}휴가 등록</button></div>
    </div>
    <div class="grid kpi-grid">
      ${kpiCard("people","전체 휴가자", onLeave.length+"명", `출산휴가 ${maternityCount}명 · 육아단축근무 ${childcareCount}명`, "info")}
      ${kpiCard("clock","복귀 예정일 경과", overdue+"명", "복귀 예정일이 지난 인원", overdue?"danger":"success")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>휴가자 목록</h3><span class="cell-muted" style="font-size:12px;">${onLeave.length}명</span></div>
      ${onLeave.length ? `<div class="table-scroll"><table>
        <thead><tr><th>직원</th><th>사업부</th><th>휴가 구분</th><th>시작일</th><th>복귀 예정일</th><th>D-day</th><th></th></tr></thead>
        <tbody>${onLeave.map(e=>{
          const d = daysUntil(e.leaveExpectedReturnDate);
          const dday = d===null ? "—" : (d>=0?`D-${d}`:`복귀 예정일 D+${-d} 경과`);
          const tone = d!==null && d<0 ? "danger" : "warning";
          const progLabel = leaveProgramLabel(e);
          return `<tr><td><div class="name-cell"><div class="avatar">${esc(initials(e.name))}</div><div><div class="cell-strong">${esc(e.name)}</div><div class="meta">${esc(e.position||"—")}</div></div></div></td><td class="cell-muted">${esc(e.division||"—")}</td><td>${workTypePill(e.workType)}${progLabel?`<div class="meta cell-muted" style="margin-top:3px;">${esc(progLabel)}</div>`:""}</td><td class="cell-muted">${fmtDate(e.leaveStartDate)}</td><td class="cell-muted">${fmtDate(e.leaveExpectedReturnDate)}</td><td>${e.leaveExpectedReturnDate?pill(dday, tone):"—"}</td><td><button class="btn btn-sm" data-edit-leave-emp="${e.id}">${ICON.edit}정보 수정</button></td></tr>`;
        }).join("")}</tbody></table></div>` : emptyState("people","현재 휴가 중인 인력이 없습니다")}
    </div>
  `;
}
export const LEAVE_TYPE_OPTIONS = ["출산휴가","육아단축근무","기타"];
export function openRegisterLeaveModal(){
  const empOptions = [...state.employees]
    .filter(emp=> emp.status!=="퇴사" && !isOnLeave(emp))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"","ko"))
    .map(emp=>`<option value="${esc(emp.id)}">${esc(emp.name)} · ${esc(emp.division||"사업부 미정")}</option>`).join("");
  const programOptions = state.subsidyPrograms.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  openModal("휴가 등록", `
    <div class="form-grid">
      <div class="field span2"><label>대상 직원 *</label><select id="lv_employee"><option value="">직원 선택</option>${empOptions}</select></div>
      <div class="field"><label>휴가 구분 *</label><select id="lv_type">${LEAVE_TYPE_OPTIONS.map(o=>`<option>${o}</option>`).join("")}</select></div>
      <div class="field"><label>시작일</label><input type="date" id="lv_start" value="${todayISO()}"></div>
      <div class="field span2"><label>복귀 예정일</label><input type="date" id="lv_end"></div>
      <div class="field span2" id="lv_programWrap" style="display:none;">
        <label>지원금 항목 (기타 사유 선택 시)</label>
        <select id="lv_program"><option value="">항목 선택 (설정 &gt; 지원금 마스터에 등록된 항목)</option>${programOptions}</select>
        <div class="hint">${state.subsidyPrograms.length?"정부 지원금 마스터에 등록된 항목 중 관련 항목을 선택할 수 있습니다.":"설정 &gt; 지원금 마스터에 등록된 항목이 없습니다. 먼저 등록해 주세요."}</div>
      </div>
    </div>
    ${empOptions?"":`<div class="field hint" style="margin-top:10px;">등록 가능한 재직 인원(이미 휴가 중이 아닌 인원)이 없습니다.</div>`}
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveLeave">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  const typeSel = byId("lv_type");
  const toggleProgramWrap = ()=>{ byId("lv_programWrap").style.display = typeSel.value==="기타" ? "" : "none"; };
  typeSel.addEventListener("change", toggleProgramWrap);
  toggleProgramWrap();
  byId("saveLeave").onclick = async ()=>{
    const empId = byId("lv_employee").value;
    if(!empId){ toast("대상 직원을 선택해 주세요."); return; }
    const emp = empById(empId);
    if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    const leaveType = typeSel.value;
    await dbUpdate("employees", emp.id, {
      workType: leaveType,
      leaveStartDate: byId("lv_start").value,
      leaveExpectedReturnDate: byId("lv_end").value,
      leaveProgramId: leaveType==="기타" ? byId("lv_program").value : "",
    });
    closeOverlay();
    toast("휴가가 등록되었습니다.");
    renderRoute();
  };
}
