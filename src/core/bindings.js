import { byId } from "./format.js";
import { renderRoute, setRoute } from "./router.js";
import { setAlertDays, setSystemPassword, setVisibleDivisions } from "../data/settings-store.js";
import { dbDelete, dbUpdate, state } from "../data/store.js";
import { empById, syncEmployeeSubsidyStatus } from "../domain/hr.js";
import { exportEmployeesExcel, openImportModal } from "../features/excel-employees.js";
import { exportSubsidyProgramsExcel, openSubsidyProgramImportModal } from "../features/excel-subsidy.js";
import { ui } from "../state/ui.js";
import { confirmDialog, toast } from "../ui/overlay.js";
import { bindDrawerEvents, openAnnualEvalModal, openContractModal, openContractRenewalModal, openEditProfileModal, openEmployeeDrawer, openProbationEvalModal, openProbationEvalViewModal, openProjectEvalModal, openRegularEvalModal } from "../views/employee-drawer.js";
import { empFilters, goToEmployeesFiltered, msArrayFor, openAddEmployeeModal } from "../views/employees.js";
import { openEmailReportModal } from "../views/hr-report.js";
import { openRegisterLeaveModal } from "../views/leave.js";
import { openSubsidyProgramModal, readSubsidyProgramForm } from "../views/subsidy-programs.js";
import { openSubsidyAppModal, openSubsidyDetailModal } from "../views/subsidy.js";
export function bindSectionEvents(){
  const root = byId("sectionRoot");
  root.querySelectorAll("[data-open-emp]").forEach(el=>{
    el.addEventListener("click", (ev)=>{
      if(ev.target.closest("button") && ev.target.closest("button")!==el) return;
      openEmployeeDrawer(el.dataset.openEmp, el.dataset.openTab);
    });
  });
  root.querySelectorAll("[data-route-to]").forEach(b=>{
    b.onclick = ()=> setRoute(b.dataset.routeTo);
    b.addEventListener("keydown", (ev)=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); b.click(); } });
  });
  root.querySelectorAll("[data-probation-eval]").forEach(b=> b.onclick = ()=>{
    const emp = empById(b.dataset.probationEval);
    if(emp) openProbationEvalModal(emp, {fromProbationList:true});
  });
  root.querySelectorAll("[data-probation-view]").forEach(b=> b.onclick = ()=>{
    const emp = empById(b.dataset.probationView);
    if(emp) openProbationEvalViewModal(emp);
  });
  root.querySelectorAll("[data-contract-renew]").forEach(b=> b.onclick = ()=>{
    const emp = empById(b.dataset.contractRenew);
    const oldContract = state.contracts.find(c=>c.id===b.dataset.contractOld);
    if(emp) openContractRenewalModal(emp, oldContract);
  });
  root.querySelectorAll("[data-edit-leave-emp]").forEach(b=> b.onclick = ()=>{
    const emp = empById(b.dataset.editLeaveEmp);
    if(emp) openEditProfileModal(emp);
  });
  const addLeaveBtn = root.querySelector("#btnAddLeave"); if(addLeaveBtn) addLeaveBtn.onclick = openRegisterLeaveModal;
  root.querySelectorAll("[data-quickfilter]").forEach(el=>{
    el.addEventListener("click", ()=>{ try{ const q = JSON.parse(el.dataset.quickfilter); goToEmployeesFiltered(q); }catch(err){} });
    el.addEventListener("keydown", (ev)=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); el.click(); } });
  });

  const addEmpBtn = root.querySelector("#btnAddEmployee"); if(addEmpBtn) addEmpBtn.onclick = openAddEmployeeModal;
  const importExcelBtn = root.querySelector("#btnImportExcel"); if(importExcelBtn) importExcelBtn.onclick = openImportModal;
  const exportEmpBtn = root.querySelector("#btnExportEmployees"); if(exportEmpBtn) exportEmpBtn.onclick = exportEmployeesExcel;
  const addContractBtn = root.querySelector("#btnAddContract"); if(addContractBtn) addContractBtn.onclick = ()=> openContractModal();
  const addEvalBtn = root.querySelector("#btnAddEval"); if(addEvalBtn) addEvalBtn.onclick = ()=>{ if(ui.evalTab==="annual") openAnnualEvalModal(); else if(ui.evalTab==="regular") openRegularEvalModal(); else openProjectEvalModal(); };
  const printReportBtn = root.querySelector("#btnPrintReport"); if(printReportBtn) printReportBtn.onclick = ()=> window.print();
  const emailReportBtn = root.querySelector("#btnEmailReport"); if(emailReportBtn) emailReportBtn.onclick = ()=> openEmailReportModal();
  const clearQuickBtn = root.querySelector("#clearQuickFilterBtn"); if(clearQuickBtn) clearQuickBtn.onclick = ()=>{ empFilters.quick = null; renderRoute(); };

  const search = root.querySelector("#empSearch");
  if(search){ search.oninput = ()=>{ empFilters.q = search.value; renderRoute(); setTimeout(()=>{ const s2=byId("empSearch"); if(s2){ s2.focus(); s2.selectionStart=s2.selectionEnd=s2.value.length; } },0); }; }
  root.querySelectorAll("[data-ms-toggle]").forEach(b=> b.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    const kind = b.dataset.msToggle;
    ui.openFilterDropdown = ui.openFilterDropdown===kind ? null : kind;
    renderRoute();
  }));
  root.querySelectorAll("[data-ms-panel]").forEach(p=> p.addEventListener("click", (ev)=> ev.stopPropagation()));
  root.querySelectorAll(".ms-cb").forEach(cb=> cb.addEventListener("change", ()=>{
    const kind = cb.dataset.msKind;
    const arr = msArrayFor(kind); if(!arr) return;
    const idx = arr.indexOf(cb.value);
    if(cb.checked){ if(idx===-1) arr.push(cb.value); }
    else { if(idx!==-1) arr.splice(idx,1); }
    ui.openFilterDropdown = kind;
    renderRoute();
  }));
  root.querySelectorAll("[data-ms-clear]").forEach(b=> b.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    const kind = b.dataset.msClear;
    const arr = msArrayFor(kind); if(arr) arr.length = 0;
    ui.openFilterDropdown = kind;
    renderRoute();
  }));

  // employee detail screen (인력 마스터 목록 → 상세 대체 화면)
  root.querySelectorAll("[data-dtab]").forEach(b=> b.onclick = ()=>{ ui.drawerTab = b.dataset.dtab; renderRoute(); });
  if(ui.drawerEmpId){ const se = empById(ui.drawerEmpId); if(se && byId("drawerBody")) bindDrawerEvents(se); }

  // 목록 → 상세 화면 대체에서 "목록으로" 뒤로가기
  root.querySelectorAll("[data-close-detail]").forEach(b=> b.onclick = ()=>{
    const kind = b.dataset.closeDetail;
    if(kind==="employees") ui.drawerEmpId = null;
    else if(kind==="subsidyPrograms") ui.selectedSubsidyProgramId = null;
    renderRoute();
  });

  root.querySelectorAll("[data-del-employee]").forEach(b=> b.onclick = async (ev)=>{
    ev.stopPropagation();
    const id = b.dataset.delEmployee;
    if(await confirmDialog("직원 삭제","이 직원을 삭제할까요? 계약·평가 등 관련 기록은 삭제되지 않고 유지됩니다.")){
      await dbDelete("employees", id);
      if(ui.drawerEmpId===id) ui.drawerEmpId = null;
      toast("직원이 삭제되었습니다.");
      renderRoute();
    }
  });
  root.querySelectorAll("[data-evtab]").forEach(b=> b.onclick = ()=>{ ui.evalTab = b.dataset.evtab; renderRoute(); });

  // subsidy program settings (설정 > 지원금 마스터)
  root.querySelectorAll("[data-save-sys-pw]").forEach(b=> b.onclick = async ()=>{
    const role = b.dataset.saveSysPw;
    const idPw = role==="admin" ? "sys_adminPw" : "sys_pmoPw";
    const idPw2 = role==="admin" ? "sys_adminPw2" : "sys_pmoPw2";
    const p1 = byId(idPw).value, p2 = byId(idPw2).value;
    if(!p1){ toast("새 암호를 입력해 주세요."); return; }
    if(p1!==p2){ toast("암호가 일치하지 않습니다."); return; }
    await setSystemPassword(role, p1);
    byId(idPw).value = ""; byId(idPw2).value = "";
  });
  root.querySelectorAll("[data-apply-division-scope]").forEach(b=> b.onclick = ()=>{
    const role = b.dataset.applyDivisionScope;
    const picked = [...root.querySelectorAll(`[data-div-checkbox="${role}"]:checked`)].map(el=>el.value);
    setVisibleDivisions(role, picked);
  });
  root.querySelectorAll("[data-clear-division-scope]").forEach(b=> b.onclick = ()=>{
    setVisibleDivisions(b.dataset.clearDivisionScope, []);
  });
  const saveAlertDaysBtn = root.querySelector("#btnSaveAlertDays"); if(saveAlertDaysBtn) saveAlertDaysBtn.onclick = ()=>{
    setAlertDays(byId("sys_alertProbation").value, byId("sys_alertContract").value);
  };
  const addSubsidyProgramBtn = root.querySelector("#btnAddSubsidyProgram"); if(addSubsidyProgramBtn) addSubsidyProgramBtn.onclick = ()=> openSubsidyProgramModal();
  const importSubsidyProgramExcelBtn = root.querySelector("#btnImportSubsidyProgramExcel"); if(importSubsidyProgramExcelBtn) importSubsidyProgramExcelBtn.onclick = openSubsidyProgramImportModal;
  const exportSubsidyProgramBtn = root.querySelector("#btnExportSubsidyPrograms"); if(exportSubsidyProgramBtn) exportSubsidyProgramBtn.onclick = exportSubsidyProgramsExcel;
  root.querySelectorAll("[data-edit-subsidy-program]").forEach(b=> b.onclick = (ev)=>{ ev.stopPropagation(); ui.selectedSubsidyProgramId = b.dataset.editSubsidyProgram; renderRoute(); });
  root.querySelectorAll("[data-del-subsidy-program]").forEach(b=> b.onclick = async (ev)=>{
    ev.stopPropagation();
    if(await confirmDialog("지원금 항목 삭제","이 지원금 항목을 삭제할까요? 이미 등록된 신청 내역에는 영향을 주지 않습니다.")){
      await dbDelete("subsidy_programs", b.dataset.delSubsidyProgram);
    }
  });
  root.querySelectorAll("[data-open-subsidy-program]").forEach(el=> el.addEventListener("click", (ev)=>{
    if(ev.target.closest("button")) return;
    ui.selectedSubsidyProgramId = el.dataset.openSubsidyProgram;
    renderRoute();
  }));
  root.querySelectorAll("[data-save-subsidy-program-detail]").forEach(b=> b.onclick = async ()=>{
    const data = readSubsidyProgramForm();
    if(!data.name){ toast("항목명을 입력해 주세요."); return; }
    await dbUpdate("subsidy_programs", b.dataset.saveSubsidyProgramDetail, data);
    toast("지원금 항목이 저장되었습니다.");
  });

  // subsidy management screen
  const addSubsidyBtn = root.querySelector("#btnAddSubsidyApp"); if(addSubsidyBtn) addSubsidyBtn.onclick = ()=> openSubsidyAppModal();
  root.querySelectorAll("[data-open-subsidy]").forEach(b=> b.onclick = ()=>{
    const app = state.subsidyApps.find(a=>a.id===b.dataset.openSubsidy);
    if(app) openSubsidyDetailModal(app);
  });
  root.querySelectorAll("[data-open-subsidy-emp]").forEach(b=> b.onclick = ()=>{
    const emp = empById(b.dataset.openSubsidyEmp);
    if(emp) openSubsidyAppModal(null, emp, "subsidy");
  });
  root.querySelectorAll("[data-del-app]").forEach(b=> b.onclick = async (ev)=>{
    ev.stopPropagation();
    const app = state.subsidyApps.find(a=>a.id===b.dataset.delApp);
    if(await confirmDialog("신청 삭제","이 정부지원금 신청 내역을 삭제할까요?")){
      await dbDelete("subsidy_applications", b.dataset.delApp);
      if(app) await syncEmployeeSubsidyStatus(app.employeeId, app.id, null);
    }
  });
}
