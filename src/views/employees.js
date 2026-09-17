import { DIVISION_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, LOCATION_OPTIONS, POSITION_OPTIONS, RECRUIT_TYPE_OPTIONS, SUBSIDY_EMP_STATUS_OPTIONS, WORK_TYPE_OPTIONS, subsidyEmpStatusTone } from "../config/options.js";
import { byId, daysUntil, ddayLabel, esc, fmtDate } from "../core/format.js";
import { setRoute } from "../core/router.js";
import { dbAdd, state } from "../data/store.js";
import { contractEffectiveStatus, empById, ensureProbationInfo, isOnLeave, pill, statusPill, syncEmployeeContractFields } from "../domain/hr.js";
import { ui } from "../state/ui.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { emptyState } from "./dashboard.js";
import { renderEmpDetailShell } from "./employee-drawer.js";
import { latestContractOf, latestProbationEvalDate, renewalDateOf } from "../domain/employee-helpers.js";
export let empFilters = { q:"", divisions:[], statuses:[], locations:[], recruitTypes:[], employmentTypes:[], quick:null };
export function msArrayFor(kind){
  switch(kind){
    case "division": return empFilters.divisions;
    case "status": return empFilters.statuses;
    case "location": return empFilters.locations;
    case "recruitType": return empFilters.recruitTypes;
    case "employmentType": return empFilters.employmentTypes;
    default: return null;
  }
}
export function employeeMatchesQuick(e, quick){
  if(!quick) return true;
  switch(quick.type){
    case "divisionActive": return e.division===quick.value && e.status!=="퇴사";
    case "subsidy": return !!e.subsidyEligible && e.subsidyEligible!=="아니오";
    case "contractExpiring": {
      const cs = state.contracts.filter(c=>c.employeeId===e.id);
      return cs.some(c=>{ const eff=contractEffectiveStatus(c); return eff.label.startsWith("만료 임박"); });
    }
    case "grade": {
      const evs = state.annualEvals.filter(ae=>ae.employeeId===e.id);
      return evs.some(ae=>ae.grade===quick.value);
    }
    case "leaveType": return isOnLeave(e);
    case "employmentType": return e.status!=="퇴사" && e.employmentType===quick.value;
    case "employmentTypeExternal": return e.status!=="퇴사" && (e.employmentType==="계약직" || e.employmentType==="외주업체");
    case "recruitType": return e.status!=="퇴사" && (e.recruitType||"정직원")===quick.value;
    case "location": return e.status!=="퇴사" && (e.location||"한국")===quick.value;
    case "probationDue": {
      if(e.status!=="수습" || !e.probation || !e.probation.endDate) return false;
      const d = daysUntil(e.probation.endDate);
      return d!==null && d>=0 && d<=30;
    }
    default: return true;
  }
}
export function quickFilterLabel(quick){
  if(!quick) return "";
  const map = {
    subsidy: ()=>"정부지원금 대상",
    contractExpiring: ()=>"계약 만료(30)",
    grade: v=>`연간평가 등급: ${v}`,
    leaveType: ()=>"출산·육아 휴가",
    employmentType: v=>`고용형태: ${v}`,
    employmentTypeExternal: ()=>"계약직 · 외주업체",
    probationDue: ()=>"수습평가 임박(30일)",
    recruitType: v=>`채용 타입: ${v}`,
    location: v=>`소속 위치: ${v}`,
  };
  const fn = map[quick.type];
  return fn ? fn(quick.value) : "필터 적용됨";
}
export function goToEmployeesFiltered(quick){
  const base = {q:"", divisions:[], locations:[], recruitTypes:[], employmentTypes:[]};
  if(quick && quick.type==="status"){ empFilters = {...base, statuses:[quick.value], quick:null}; }
  else if(quick && quick.type==="divisionActive"){ empFilters = {...base, divisions:[quick.value], statuses:["수습","근무"], quick:null}; }
  else if(quick && quick.type==="activeAll"){ empFilters = {...base, statuses:["수습","근무"], quick:null}; }
  else { empFilters = {...base, statuses:["수습","근무"], quick: quick||null}; }
  ui.openFilterDropdown = null;
  closeOverlay();
  setRoute("employees");
}
export function msLabel(prefix, arr, options){
  if(!arr.length) return `${prefix} 전체`;
  if(arr.length===options.length) return `${prefix} 전체`;
  if(arr.length<=2) return `${prefix}: ${arr.join(", ")}`;
  return `${prefix} (${arr.length})`;
}
export function msFilterDropdown(kind, prefix, options, selected, icon){
  const open = ui.openFilterDropdown===kind;
  return `
    <div class="ms-filter">
      <button type="button" class="btn btn-sm ms-filter-btn ${selected.length?"active":""}" data-ms-toggle="${kind}">${ICON[icon]}${esc(msLabel(prefix, selected, options))}${ICON.chevron}</button>
      <div class="ms-filter-panel ${open?"open":""}" data-ms-panel="${kind}">
        ${options.map(o=>`<label class="ms-filter-opt"><input type="checkbox" class="ms-cb" data-ms-kind="${kind}" value="${esc(o)}" ${selected.includes(o)?"checked":""}> ${esc(o)}</label>`).join("")}
        <div class="ms-filter-actions"><button type="button" class="btn btn-sm" data-ms-clear="${kind}">전체 해제</button></div>
      </div>
    </div>
  `;
}
export function filteredEmployeesForMaster(){
  return state.employees.filter(e=>{
    if(empFilters.statuses.length && !empFilters.statuses.includes(e.status)) return false;
    if(empFilters.divisions.length && !empFilters.divisions.includes(e.division)) return false;
    if(empFilters.locations.length && !empFilters.locations.includes(e.location||"한국")) return false;
    if(empFilters.recruitTypes.length && !empFilters.recruitTypes.includes(e.recruitType||"정직원")) return false;
    if(empFilters.employmentTypes.length && !empFilters.employmentTypes.includes(e.employmentType)) return false;
    if(empFilters.quick && !employeeMatchesQuick(e, empFilters.quick)) return false;
    if(empFilters.q){
      const q = empFilters.q.toLowerCase();
      if(!(`${e.name} ${e.empNo||""} ${e.division||""}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}
export function renderEmployees(){
  if(ui.drawerEmpId){
    const sel = empById(ui.drawerEmpId);
    if(sel){
      return `
        <div class="topbar">
          <button class="btn btn-sm" data-close-detail="employees">${ICON.back}목록으로</button>
          <div class="topbar-actions"><button class="btn btn-danger-ghost btn-sm" data-del-employee="${sel.id}">${ICON.trash}삭제</button></div>
        </div>
        <div class="panel">
          ${renderEmpDetailShell(sel)}
          <div class="drawer-foot">
            <button class="btn" data-close-detail="employees">${ICON.back}목록으로</button>
          </div>
        </div>
      `;
    }
    ui.drawerEmpId = null;
  }
  const statusOptions = ["수습","근무","퇴사"];
  const rows = filteredEmployeesForMaster();
  return `
    <div class="topbar">
      <div><h1>인력 마스터</h1><div class="desc">입사일 · 수습평가일 · 최종 계약일 등 직원 기준정보를 한눈에 확인합니다. 행을 클릭하면 상세 정보를 참조할 수 있습니다.</div></div>
      <div class="topbar-actions">
        <button class="btn" id="btnExportEmployees">${ICON.download}다운로드</button>
        <button class="btn" id="btnImportExcel">${ICON.upload}엑셀 업로드</button>
        <button class="btn btn-primary" id="btnAddEmployee">${ICON.plus}신규 직원 등록</button>
      </div>
    </div>
    <div class="panel">
      <div class="toolbar">
        <div class="search-box">${ICON.search}<input id="empSearch" placeholder="이름, 사번, 사업부 검색" value="${esc(empFilters.q)}"></div>
        ${msFilterDropdown("division", "사업부", DIVISION_OPTIONS, empFilters.divisions, "folder")}
        ${msFilterDropdown("status", "상태", statusOptions, empFilters.statuses, "people")}
        ${msFilterDropdown("location", "소속 위치", LOCATION_OPTIONS, empFilters.locations, "doc")}
        ${msFilterDropdown("recruitType", "채용 타입", RECRUIT_TYPE_OPTIONS, empFilters.recruitTypes, "star")}
        ${msFilterDropdown("employmentType", "고용형태", EMPLOYMENT_TYPE_OPTIONS, empFilters.employmentTypes, "folder")}
      </div>
      ${empFilters.quick ? `<div class="filter-chip-row"><span class="pill pill-info">필터: ${esc(quickFilterLabel(empFilters.quick))} <button class="icon-btn" style="padding:0 0 0 6px;" id="clearQuickFilterBtn">${ICON.x}</button></span></div>` : ""}
      <div class="cell-muted" style="padding:8px 14px 0; font-size:12px;">${rows.length}명 표시 중</div>
      ${rows.length ? `<div class="table-scroll"><table>
        <thead><tr><th>이름</th><th>사업부</th><th>고용형태</th><th>재직상태</th><th>입사일</th><th>수습평가일 (최근)</th><th>최종 계약일</th><th>재계약 예정일</th><th>지원금대상자</th><th></th></tr></thead>
        <tbody>${rows.map(e=>{
          const lc = latestContractOf(e.id);
          // 계약 관리 대기 리스트와 같은 기준을 쓴다 (종료일, 없으면 시작일+12개월)
          const renewalDate = renewalDateOf(lc);
          const lastProbDate = latestProbationEvalDate(e);
          return `<tr class="clickable" data-open-emp="${e.id}" data-open-tab="profile">
            <td class="cell-strong">${esc(e.name)}${e.isSample?'<span class="tag-sample">샘플</span>':""}</td>
            <td class="cell-muted">${esc(e.division||"—")}</td>
            <td class="cell-muted">${esc(e.employmentType||"—")}</td>
            <td>${statusPill(e.status)}</td>
            <td class="cell-muted">${fmtDate(e.hireDate)}</td>
            <td class="cell-muted">${lastProbDate?fmtDate(lastProbDate):"—"}</td>
            <td class="cell-muted">${lc?fmtDate(lc.startDate):"—"}</td>
            <td class="cell-muted">${renewalDate ? `${fmtDate(renewalDate)} (${ddayLabel(renewalDate)})` : "—"}</td>
            <td>${pill(e.subsidyEligible||"아니오", subsidyEmpStatusTone(e.subsidyEligible))}</td>
            <td><button class="icon-btn" data-del-employee="${e.id}">${ICON.trash}</button></td>
          </tr>`;
        }).join("")}</tbody></table></div>` : emptyState("people", state.employees.length ? "조건에 맞는 직원이 없습니다" : "등록된 직원이 없습니다. 신규 직원을 등록해 보세요.")}
    </div>
  `;
}

export function employeeFormFields(e){
  e = e || {};
  return `
    <div class="form-grid">
      <div class="field"><label>이름 *</label><input id="f_name" value="${esc(e.name||"")}"></div>
      <div class="field"><label>사번</label><input id="f_empNo" value="${esc(e.empNo||"")}"></div>
      <div class="field"><label>사업부</label><select id="f_division">
        <option value="">사업부 선택</option>
        ${DIVISION_OPTIONS.map(o=>`<option value="${esc(o)}" ${e.division===o?"selected":""}>${esc(o)}</option>`).join("")}
      </select></div>
      <div class="field"><label>직급 / 직책</label><select id="f_position">
        <option value="">직급 선택</option>
        ${POSITION_OPTIONS.map(o=>`<option value="${esc(o)}" ${e.position===o?"selected":""}>${esc(o)}</option>`).join("")}
        ${e.position && !POSITION_OPTIONS.includes(e.position) ? `<option value="${esc(e.position)}" selected>${esc(e.position)} (기존 값)</option>` : ""}
      </select></div>
      <div class="field"><label>고용형태</label><select id="f_employmentType">${EMPLOYMENT_TYPE_OPTIONS.map(o=>`<option ${e.employmentType===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>재직상태</label><select id="f_status">${["수습","근무","퇴사"].map(o=>`<option value="${o}" ${e.status===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>근무형태</label><select id="f_workType">${WORK_TYPE_OPTIONS.map(o=>`<option ${(e.workType||"일반근무")===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>휴가 시작일</label><input type="date" id="f_leaveStartDate" value="${esc(e.leaveStartDate||"")}"></div>
      <div class="field"><label>복귀 예정일</label><input type="date" id="f_leaveExpectedReturnDate" value="${esc(e.leaveExpectedReturnDate||"")}"></div>
      <div class="field span2" id="f_leaveProgramWrap" style="${e.workType==="기타"?"":"display:none;"}">
        <label>지원금 항목 (기타 사유 선택 시)</label>
        <select id="f_leaveProgramId"><option value="">항목 선택 (설정 &gt; 지원금 마스터에 등록된 항목)</option>${state.subsidyPrograms.map(p=>`<option value="${esc(p.id)}" ${e.leaveProgramId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select>
        <div class="hint">근무형태를 "기타"로 선택한 경우, 정부 지원금 마스터에 등록된 항목 중 관련 항목을 선택할 수 있습니다.</div>
      </div>
      <div class="field"><label>채용 타입</label><select id="f_recruitType">${RECRUIT_TYPE_OPTIONS.map(o=>`<option ${(e.recruitType||"정직원")===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>소속 위치</label><select id="f_location">${LOCATION_OPTIONS.map(o=>`<option ${(e.location||"한국")===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>생년월일</label><input type="date" id="f_birthDate" value="${esc(e.birthDate||"")}"></div>
      <div class="field"><label>입사일</label><input type="date" id="f_hireDate" value="${esc(e.hireDate||"")}"></div>
      <div class="field"><label>업무시작일</label><input type="date" id="f_workStartDate" value="${esc(e.workStartDate||"")}"></div>
      <div class="field"><label>연락처</label><input id="f_phone" value="${esc(e.phone||"")}"></div>
      <div class="field span2"><label>이메일</label><input type="email" id="f_email" value="${esc(e.email||"")}"></div>
      ${e.id ? `
      <!-- 수정 화면 — 연봉·최종 계약일은 계약에서 파생되는 값이라 직접 못 고친다.
           고칠 수 있게 두면 계약과 갈라진다(실제로 갈라졌었다). -->
      <div class="field"><label>현재 연봉 (만원)</label><input type="number" id="f_currentSalary" value="${esc(e.currentSalary??"")}" readonly><div class="hint">계약에서 자동 계산됩니다. "계약 · 연봉" 탭에서 계약을 등록하세요.</div></div>
      <div class="field"><label>최종 계약일</label><input type="date" id="f_lastContractDate" value="${esc(e.lastContractDate||"")}" readonly><div class="hint">가장 최근 계약의 시작일입니다.</div></div>
      ` : `
      <!-- 신규 등록 — 여기 넣은 값으로 첫 계약이 자동 생성된다(saveNewEmp). -->
      <div class="field"><label>연봉 (만원)</label><input type="number" id="f_currentSalary" value=""><div class="hint">입력하면 이 값으로 <b>첫 계약이 자동 등록</b>됩니다.</div></div>
      <div class="field"><label>계약 시작일</label><input type="date" id="f_lastContractDate" value=""><div class="hint">비우면 입사일을 씁니다.</div></div>
      `}
      <div class="field"><label>지원금 대상자</label><select id="f_subsidyEligible">${SUBSIDY_EMP_STATUS_OPTIONS.map(o=>`<option value="${o}" ${(e.subsidyEligible||"아니오")===o?"selected":""}>${o}</option>`).join("")}</select><div class="hint">지원금 신청이 등록·진행되면 신청 상태에 따라 자동으로 갱신됩니다.</div></div>
    </div>
  `;
}
/** 고용형태에 맞는 계약 구분 — 신규 등록 시 첫 계약에 쓴다. */
export function contractTypeFor(employmentType){
  if(employmentType === "계약직") return "계약직 근로계약";
  if(employmentType === "외주업체") return "프리랜서 계약";
  return "정규직 근로계약";
}

export function readEmployeeForm(){
  return {
    name: byId("f_name").value.trim(),
    empNo: byId("f_empNo").value.trim(),
    division: byId("f_division").value,
    position: byId("f_position").value.trim(),
    employmentType: byId("f_employmentType").value,
    status: byId("f_status").value,
    workType: byId("f_workType").value,
    leaveStartDate: byId("f_leaveStartDate").value,
    leaveExpectedReturnDate: byId("f_leaveExpectedReturnDate").value,
    leaveProgramId: byId("f_workType").value==="기타" ? (byId("f_leaveProgramId")?byId("f_leaveProgramId").value:"") : "",
    recruitType: byId("f_recruitType").value,
    location: byId("f_location").value,
    birthDate: byId("f_birthDate").value,
    hireDate: byId("f_hireDate").value,
    workStartDate: byId("f_workStartDate").value,
    phone: byId("f_phone").value.trim(),
    email: byId("f_email").value.trim(),
    currentSalary: Number(byId("f_currentSalary").value)||0,
    lastContractDate: byId("f_lastContractDate").value,
    subsidyEligible: byId("f_subsidyEligible").value,
  };
}
export function bindLeaveProgramToggle(){
  const wtSel = byId("f_workType");
  if(!wtSel) return;
  wtSel.addEventListener("change", ()=>{
    const wrap = byId("f_leaveProgramWrap");
    if(wrap) wrap.style.display = wtSel.value==="기타" ? "" : "none";
  });
}
export function openAddEmployeeModal(){
  openModal("신규 직원 등록", employeeFormFields(), `
    <button class="btn" data-cancel>취소</button>
    <button class="btn btn-primary" id="saveNewEmp">등록</button>
  `);
  bindLeaveProgramToggle();
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveNewEmp").onclick = async ()=>{
    const data = readEmployeeForm();
    if(!data.name){ toast("이름을 입력해 주세요."); return; }
    data.resume = {education:[], careerHistory:[], certifications:[], skills:[]};
    data.currentTasks = [];
    data.probation = {};
    // 재직상태를 "수습" 으로 골랐으면 수습 정보를 채워 수습 관리에 바로 잡히게 한다.
    Object.assign(data, ensureProbationInfo(data));
    // 연봉·최종 계약일은 계약에서 파생되는 값이다. 직원 레코드에 바로 넣지 않고
    // 아래에서 첫 계약을 만든 뒤 거기서 다시 계산한다.
    const initialSalary = data.currentSalary;
    const initialStart = data.lastContractDate || data.hireDate || "";
    data.currentSalary = 0;
    data.lastContractDate = "";

    const newId = await dbAdd("employees", data);
    if(newId && (initialSalary > 0 || data.lastContractDate)){
      await dbAdd("contracts", {
        employeeId: newId, employeeName: data.name,
        contractType: contractTypeFor(data.employmentType),
        startDate: initialStart, endDate: "",
        annualSalary: initialSalary,
        changeReason: "신규", signedDate: initialStart, status: "대기",
      });
      await syncEmployeeContractFields(newId);
    }
    closeOverlay();
    toast(initialSalary > 0 ? "직원이 등록되고 첫 계약이 함께 생성되었습니다." : "직원이 등록되었습니다.");
    setRoute("employees");
  };
}
