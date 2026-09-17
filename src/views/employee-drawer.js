import { CONTRACT_STATUS_OPTIONS, EVAL_ITEMS, subsidyEmpStatusTone } from "../config/options.js";
import { addMonths, ageFromBirth, byId, ddayLabel, esc, fmtDate, fmtWon, todayISO, yearsMonthsLabel } from "../core/format.js";
import { renderRoute, setRoute } from "../core/router.js";
import { dbAdd, dbDelete, dbUpdate, state } from "../data/store.js";
import { contractedEmployees, empById, ensureProbationInfo, gradeFromScore, gradeTone, pill, statusPill, syncEmployeeContractFields, workTypePill } from "../domain/hr.js";
import { ui } from "../state/ui.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, confirmDialog, openModal, toast } from "../ui/overlay.js";
import { emptyState } from "./dashboard.js";
import { bindLeaveProgramToggle, contractTypeFor, employeeFormFields, readEmployeeForm } from "./employees.js";
import { probationOpinionTone } from "./evaluations.js";
export const DRAWER_TABS = [
  {key:"profile", label:"기본정보 · 업무"},
  {key:"resume", label:"이력서"},
  {key:"contracts", label:"계약 · 연봉"},
  {key:"probation", label:"수습평가(3개월)"},
];
export function openEmployeeDrawer(empId, tab){
  const e = empById(empId);
  if(!e){ toast("직원 정보를 찾을 수 없습니다."); return; }
  ui.drawerEmpId = empId; ui.drawerTab = tab || "profile";
  ui.editingProfile = false;   // 다른 직원을 열면 편집 모드는 풀린다
  setRoute("employees");
}
export function renderEmpDetailShell(e){
  const renderers = {
    profile: drawerProfile, resume: drawerResume, projectEval: drawerProjectEval,
    annualEval: drawerAnnualEval, regularEval: drawerRegularEval, contracts: drawerContracts, probation: drawerProbation,
  };
  return `
    <div class="drawer-head">
      <div><h3>${esc(e.name)}</h3><div class="id-line">${esc(e.division||"사업부 미정")} · ${esc(e.position||"직급 미정")} · 사번 ${esc(e.empNo||"—")}</div></div>
    </div>
    <div class="drawer-tabs">
      ${DRAWER_TABS.map(t=>`<button class="drawer-tab ${ui.drawerTab===t.key?"active":""}" data-dtab="${t.key}">${esc(t.label)}</button>`).join("")}
    </div>
    <div class="drawer-body" id="drawerBody">${(renderers[ui.drawerTab]||drawerProfile)(e)}</div>
  `;
}

export function drawerProfile(e){
  // 수정은 모달로 넘어가지 않고 이 자리에서 한다. 편집 중에는 각 칸이
  // 입력칸으로 바뀌고 아래에 "완료" 가 생기며, 저장하면 다시 사라진다.
  const editing = !!ui.editingProfile;
  return `
    <div class="subhead">
      <h4>기본 정보</h4>
      ${editing
        ? `<span class="hint" style="margin:0;">고칠 항목을 바로 수정한 뒤 완료를 누르세요</span>`
        : `<button class="btn btn-sm" data-edit-profile>${ICON.edit}수정</button>`}
    </div>
    ${editing ? `
      ${employeeFormFields(e)}
      <div class="drawer-foot" style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn" data-cancel-profile>취소</button>
        <button class="btn btn-primary" data-save-profile>${ICON.check||""}완료</button>
      </div>
    ` : `
    <div class="form-grid info-grid" style="font-size:13px;">
      ${infoField("이름", e.name)}${infoField("사번", e.empNo)}
      ${infoField("사업부", e.division)}
      ${infoField("직급/직책", e.position)}${infoField("고용형태", e.employmentType)}
      ${infoField("채용 타입", e.recruitType||"—")}${infoField("소속 위치", e.location||"—")}
      ${infoField("재직상태", statusPill(e.status))}${infoField("근무형태", workTypePill(e.workType))}
      ${infoField("생년월일", e.birthDate ? `${fmtDate(e.birthDate)} (만 ${ageFromBirth(e.birthDate)}세)` : "—")}
      ${infoField("입사일", fmtDate(e.hireDate))}${infoField("업무시작일", e.workStartDate ? fmtDate(e.workStartDate) : "—")}
      ${infoField("근속기간", yearsMonthsLabel(e.hireDate))}${infoField("연락처", e.phone)}
      ${infoField("현재 연봉", e.currentSalary?fmtWon(e.currentSalary):"—", false, "계약에서 자동 계산")}${infoField("최종 계약일", e.lastContractDate?fmtDate(e.lastContractDate):"—", false, "계약에서 자동 계산")}
      ${infoField("지원금 대상자", pill(e.subsidyEligible||"아니오", subsidyEmpStatusTone(e.subsidyEligible)))}
      ${infoField("이메일", e.email, true)}
    </div>`}
    <div class="divider"></div>
    <div class="subhead"><h4>담당 업무</h4><button class="btn btn-sm" data-add-task>${ICON.plus}업무 추가</button></div>
    ${(e.currentTasks||[]).length ? (e.currentTasks||[]).map((t,i)=>`
      <div class="list-row">
        <div class="main-txt"><div class="t1">${esc(t.task)}</div><div class="t2">갱신일 ${fmtDate(t.updatedDate)}</div></div>
        <select class="filter task-status-sel" data-task-idx="${i}" style="padding:5px 8px; font-size:12px;">
          ${["진행중","완료","보류"].map(s=>`<option ${t.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <button class="icon-btn" data-del-task="${i}">${ICON.trash}</button>
      </div>`).join("") : emptyState("folder","등록된 업무가 없습니다")}
  `;
}
/**
 * 읽기 모드의 한 칸. 테두리를 둘러 어디까지가 한 항목인지 눈에 보이게 한다.
 * note 를 주면 "왜 여기서 못 고치는지" 같은 설명을 작게 덧붙인다.
 */
export function infoField(label, val, span2, note){
  return `<div class="field info-box ${span2?"span2":""}">
    <label>${esc(label)}</label>
    <div class="info-val">${val===undefined||val===null||val===""?"—":val}</div>
    ${note?`<div class="hint" style="margin-top:4px;">${esc(note)}</div>`:""}
  </div>`;
}

export function drawerResume(e){
  const r = e.resume || {education:[], careerHistory:[], certifications:[], skills:[]};
  return `
    <div class="subhead"><h4>학력</h4><button class="btn btn-sm" data-add-edu>${ICON.plus}추가</button></div>
    ${(r.education||[]).length ? r.education.map((ed,i)=>`
      <div class="list-row"><div class="main-txt"><div class="t1">${esc(ed.school)} · ${esc(ed.major||"")}</div><div class="t2">${esc(ed.degree||"")} · 졸업 ${esc(ed.gradYear||"—")}</div></div><button class="icon-btn" data-del-edu="${i}">${ICON.trash}</button></div>
    `).join("") : emptyState("doc","등록된 학력이 없습니다")}

    <div class="subhead"><h4>경력</h4><button class="btn btn-sm" data-add-career>${ICON.plus}추가</button></div>
    ${(r.careerHistory||[]).length ? r.careerHistory.map((c,i)=>`
      <div class="list-row"><div class="main-txt"><div class="t1">${esc(c.company)} · ${esc(c.role||"")}</div><div class="t2">${esc(c.period||"")}${c.description?" · "+esc(c.description):""}</div></div><button class="icon-btn" data-del-career="${i}">${ICON.trash}</button></div>
    `).join("") : emptyState("doc","등록된 경력이 없습니다")}

    <div class="subhead"><h4>자격증</h4><button class="btn btn-sm" data-add-cert>${ICON.plus}추가</button></div>
    ${(r.certifications||[]).length ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">${r.certifications.map((c,i)=>`<span class="pill pill-info">${esc(c)}<button class="icon-btn" style="padding:0; margin-left:4px;" data-del-cert="${i}">${ICON.x}</button></span>`).join("")}</div>` : emptyState("star","등록된 자격증이 없습니다")}

    <div class="subhead"><h4>보유 스킬</h4><button class="btn btn-sm" data-add-skill>${ICON.plus}추가</button></div>
    ${(r.skills||[]).length ? `<div style="display:flex; flex-wrap:wrap; gap:6px;">${r.skills.map((s,i)=>`<span class="pill pill-muted">${esc(s)}<button class="icon-btn" style="padding:0; margin-left:4px;" data-del-skill="${i}">${ICON.x}</button></span>`).join("")}</div>` : emptyState("star","등록된 스킬이 없습니다")}
  `;
}

export function drawerProjectEval(e){
  const evals = state.projectEvals.filter(pe=>pe.employeeId===e.id).sort((a,b)=> (b.evalDate||"").localeCompare(a.evalDate||""));
  return `
    <div class="subhead"><h4>프로젝트 평가 이력</h4><button class="btn btn-sm btn-primary" data-add-projeval>${ICON.plus}평가 등록</button></div>
    ${evals.length ? evals.map(ev=>`
      <div class="list-row" style="align-items:flex-start;">
        <div class="main-txt">
          <div class="t1">${esc(ev.projectName||"프로젝트 미지정")} <span class="pill pill-${gradeTone(gradeFromScore(ev.score))}" style="margin-left:6px;">${gradeFromScore(ev.score)} · ${esc(ev.score)}점</span>${ev.isSample?'<span class="tag-sample">샘플</span>':""}</div>
          <div class="t2">역할 ${esc(ev.role||"—")} · 기간 ${esc(ev.period||"—")} · 평가자 ${esc(ev.evaluator||"—")} · ${fmtDate(ev.evalDate)}</div>
          ${ev.strengths?`<div class="t2" style="margin-top:4px;"><b>강점</b> ${esc(ev.strengths)}</div>`:""}
          ${ev.improvements?`<div class="t2"><b>개선점</b> ${esc(ev.improvements)}</div>`:""}
        </div>
        <button class="icon-btn" data-del-projeval="${ev.id}">${ICON.trash}</button>
      </div>
    `).join("") : emptyState("star","등록된 프로젝트 평가가 없습니다")}
  `;
}

export function drawerAnnualEval(e){
  const evals = state.annualEvals.filter(ae=>ae.employeeId===e.id).sort((a,b)=> (b.year||0)-(a.year||0));
  return `
    <div class="subhead"><h4>연간 평가 이력</h4><button class="btn btn-sm btn-primary" data-add-annualeval>${ICON.plus}평가 등록</button></div>
    ${evals.length ? evals.map(ev=>`
      <div class="list-row" style="align-items:flex-start;">
        <div class="main-txt">
          <div class="t1">${esc(ev.year)}년 평가 <span class="pill pill-${gradeTone(ev.grade)}" style="margin-left:6px;">${esc(ev.grade)} 등급 · ${esc(ev.score)}점</span>${ev.isSample?'<span class="tag-sample">샘플</span>':""}</div>
          <div class="t2">평가자 ${esc(ev.evaluator||"—")} · ${fmtDate(ev.evalDate)}</div>
          ${ev.items && ev.items.length ? ev.items.map(it=>`<div class="t2" style="margin-top:4px;"><b>${esc(it.key)} (${esc(it.grade)})</b>${it.comment?` ${esc(it.comment)}`:""}</div>`).join("") : (ev.competencies ? `<div class="t2" style="margin-top:4px;">업무성과 ${ev.competencies.성과??"—"} · 협업 ${ev.competencies.협업??"—"} · 전문성 ${ev.competencies.전문성??"—"} · 성장가능성 ${ev.competencies.성장??"—"}</div>` : "")}
          ${ev.comment?`<div class="t2" style="margin-top:4px;"><b>코멘트</b> ${esc(ev.comment)}</div>`:""}
          ${ev.promotionOpinion?`<div class="t2" style="margin-top:4px;"><b>승진 의견</b> ${esc(ev.promotionOpinion)}</div>`:""}
        </div>
        <button class="icon-btn" data-del-annualeval="${ev.id}">${ICON.trash}</button>
      </div>
    `).join("") : emptyState("star","등록된 연간 평가가 없습니다")}
  `;
}

export function drawerRegularEval(e){
  const evals = state.regularEvals.filter(re=>re.employeeId===e.id).sort((a,b)=> (b.evalDate||"").localeCompare(a.evalDate||""));
  return `
    <div class="subhead">
      <h4>상시 평가 이력 <span class="hint">무기명 · 상시로 등록하는 수시 평가입니다</span></h4>
      <button class="btn btn-sm btn-primary" data-add-regulareval>${ICON.plus}평가 등록</button>
    </div>
    ${evals.length ? evals.map(ev=>`
      <div class="list-row" style="align-items:flex-start;">
        <div class="main-txt">
          <div class="t1">${fmtDate(ev.evalDate)} 상시 평가 ${ev.grade?`<span class="pill pill-${gradeTone(ev.grade)}" style="margin-left:6px;">${esc(ev.grade)} 등급</span>`:""}<span class="pill pill-muted" style="margin-left:6px;">무기명</span></div>
          ${ev.items && ev.items.length ? `<div class="t2" style="margin-top:4px;">${ev.items.map(it=>`${esc(it.key)}(${esc(it.grade)})`).join(" · ")}</div>` : ""}
          ${ev.comment?`<div class="t2" style="margin-top:4px;"><b>코멘트</b> ${esc(ev.comment)}</div>`:""}
        </div>
        <button class="icon-btn" data-del-regulareval="${ev.id}">${ICON.trash}</button>
      </div>
    `).join("") : emptyState("star","등록된 상시 평가가 없습니다")}
  `;
}

/**
 * 계약 상태를 표 안에서 바로 바꾸는 드롭다운.
 * 지원금 신청의 진행 상태(subsidy.js)와 같은 방식이다.
 *
 * 저장된 status 를 그대로 보여준다 — contractEffectiveStatus() 는 종료일이
 * 지나면 "지연" 으로 보이게 하는 표시용 계산이라, 선택값으로 쓰면 사용자가
 * 고르지 않은 값이 저장된 것처럼 보인다.
 */
function contractStatusSelect(c){
  const cur = CONTRACT_STATUS_OPTIONS.includes(c.status) ? c.status : "대기";
  return `<select class="status-select" data-contract-status="${esc(c.id)}">
    ${CONTRACT_STATUS_OPTIONS.map(s=>`<option ${cur===s?"selected":""}>${s}</option>`).join("")}
  </select>`;
}

export function drawerContracts(e){
  const cs = state.contracts.filter(c=>c.employeeId===e.id).sort((a,b)=> (b.startDate||"").localeCompare(a.startDate||""));
  return `
    <div class="subhead"><h4>계약 · 연봉 이력</h4><button class="btn btn-sm btn-primary" data-add-contract>${ICON.plus}계약 등록</button></div>
    ${cs.length ? `<div class="table-scroll"><table>
      <thead><tr><th>계약구분</th><th>계약기간</th><th>연봉</th><th>사이닝보너스</th><th>채용수수료</th><th>사유</th><th>상태</th><th></th></tr></thead>
      <tbody>${cs.map(c=>{ return `
        <tr><td>${esc(c.contractType||"—")}${c.isSample?'<span class="tag-sample">샘플</span>':""}</td><td class="cell-muted">${fmtDate(c.startDate)} ~ ${fmtDate(c.endDate)||"—"}</td><td class="num cell-strong">${fmtWon(c.annualSalary)}</td><td class="num cell-muted">${c.signingBonus?fmtWon(c.signingBonus):"—"}</td><td class="num cell-muted">${c.recruitingFee?fmtWon(c.recruitingFee):"—"}</td><td class="cell-muted">${esc(c.changeReason||"—")}</td><td>${contractStatusSelect(c)}</td><td><button class="icon-btn" data-del-contract="${c.id}">${ICON.trash}</button></td></tr>
      `;}).join("")}</tbody></table></div>` : emptyState("doc","등록된 계약이 없습니다")}
  `;
}

export function renderProbationEvalList(evaluations, opts){
  opts = opts || {};
  const withDelete = !!opts.withDelete;
  const evalList = (evaluations||[]).map((ev,i)=>({ev,i})).sort((a,b)=> (b.ev.date||"").localeCompare(a.ev.date||""));
  if(!evalList.length) return emptyState("star","등록된 평가가 없습니다");
  return evalList.map(({ev,i})=>`
      <div class="list-row" style="align-items:flex-start;">
        <div class="main-txt">
          <div class="t1">${esc(ev.type||(ev.grade?"수습 평가":"프로젝트 평가"))}
            <span class="pill pill-${probationOpinionTone(ev.finalOpinion)}" style="margin-left:6px;">${esc(ev.finalOpinion||"—")}</span>
            ${ev.grade?`<span class="pill pill-info" style="margin-left:4px;">${esc(ev.grade)}등급 · ${esc(ev.score)}점</span>`:""}
            ${ev.type==="재계약 평가" && ev.raisePct!==undefined ? `<span class="pill pill-info" style="margin-left:4px;">연봉인상 제안 ${esc(ev.raisePct)}%</span>` : ""}
          </div>
          <div class="t2">${fmtDate(ev.date)} · 평가자 ${esc(ev.evaluator||"—")}</div>
          ${ev.items && ev.items.length ? ev.items.map(it=>`<div class="t2" style="margin-top:4px;"><b>${esc(it.key)} (${esc(it.grade)})</b>${it.comment?` ${esc(it.comment)}`:""}</div>`).join("") : ""}
          ${ev.comment?`<div class="t2" style="margin-top:4px;"><b>코멘트</b> ${esc(ev.comment)}</div>`:""}
          ${ev.overallComment?`<div class="t2" style="margin-top:4px;"><b>종합의견</b> ${esc(ev.overallComment)}</div>`:""}
          ${ev.improvements?`<div class="t2"><b>보완 필요사항</b> ${esc(ev.improvements)}</div>`:""}
          ${ev.expectations?`<div class="t2"><b>향후 기대사항</b> ${esc(ev.expectations)}</div>`:""}
          ${ev.attitude?`<div class="t2" style="margin-top:4px;"><b>수행태도</b> ${esc(ev.attitude)}</div>`:""}
          ${ev.performance?`<div class="t2"><b>수행성과</b> ${esc(ev.performance)}</div>`:""}
          ${ev.capability?`<div class="t2"><b>수용능력</b> ${esc(ev.capability)}</div>`:""}
        </div>
        ${withDelete ? `<button class="icon-btn" data-del-probation-eval="${i}">${ICON.trash}</button>` : ""}
      </div>
  `).join("");
}
export function drawerProbation(e){
  const p = e.probation || {};
  if(!p.startDate){
    return `${emptyState("clock","수습(3개월) 정보가 등록되지 않았습니다")}
      <div style="text-align:center;"><button class="btn btn-primary" data-start-probation>${ICON.plus}수습 시작 등록</button></div>`;
  }
  return `
    <div class="stat-mini-grid" style="margin-bottom:18px;">
      <div class="stat-mini"><div class="v">${fmtDate(p.startDate)}</div><div class="l">수습 시작일</div></div>
      <div class="stat-mini"><div class="v">${fmtDate(p.endDate)}</div><div class="l">수습 종료일(3개월)</div></div>
      <div class="stat-mini"><div class="v">${ddayLabel(p.endDate)}</div><div class="l">종료까지 D-day</div></div>
      <div class="stat-mini"><div class="v">${pill(p.finalDecision||"대기", p.finalDecision==="합격"?"success":p.finalDecision==="불합격"?"danger":p.finalDecision==="지연"?"warning":"muted")}</div><div class="l">최종 판정</div></div>
    </div>
    <div class="subhead"><h4>평가 이력</h4><button class="btn btn-sm btn-primary" data-add-probation-eval>${ICON.plus}평가 등록</button></div>
    ${renderProbationEvalList(p.evaluations, {withDelete:true})}
    <div class="divider"></div>
    <div class="subhead"><h4>최종 판정</h4></div>
    <div class="form-grid">
      <div class="field"><label>최종 판정</label><select id="finalDecisionSel">${["대기","지연","합격","불합격"].map(o=>`<option ${(p.finalDecision||"대기")===o?"selected":""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>판정일</label><input type="date" id="finalDecisionDate" value="${esc(p.finalDecisionDate||"")}"></div>
      <div class="field span2"><label>최종 코멘트</label><textarea id="finalComment" rows="2">${esc(p.finalComment||"")}</textarea></div>
    </div>
    <div style="margin-top:14px; text-align:right;"><button class="btn btn-primary" data-save-probation>최종 판정 저장</button></div>
  `;
}

/* ---- drawer event binding ---- */
export function bindDrawerEvents(e){
  const root = byId("drawerBody");

  // profile — 그 자리에서 수정한다 (모달로 넘어가지 않는다)
  const editBtn = root.querySelector("[data-edit-profile]");
  if(editBtn) editBtn.onclick = ()=>{ ui.editingProfile = true; renderRoute(); };

  const cancelProfileBtn = root.querySelector("[data-cancel-profile]");
  if(cancelProfileBtn) cancelProfileBtn.onclick = ()=>{ ui.editingProfile = false; renderRoute(); };

  const saveProfileBtn = root.querySelector("[data-save-profile]");
  if(saveProfileBtn){
    // 근무형태 "기타" 를 고르면 지원금 항목 칸이 열리는 동작은 폼과 함께 다시 붙인다.
    bindLeaveProgramToggle();
    saveProfileBtn.onclick = async ()=>{
      const data = readEmployeeForm();
      if(!data.name){ toast("이름을 입력해 주세요."); return; }
      // 재직상태를 "수습" 으로 바꿨으면 수습 정보를 채운다.
      await dbUpdate("employees", e.id, ensureProbationInfo({ ...e, ...data }));
      ui.editingProfile = false;   // 완료 버튼은 여기서 사라진다
      toast("저장되었습니다.");
      refreshDrawerAfterMutate(e.id);
    };
  }
  const addTaskBtn = root.querySelector("[data-add-task]");
  if(addTaskBtn) addTaskBtn.onclick = ()=> openAddTaskModal(e);
  root.querySelectorAll("[data-del-task]").forEach(b=> b.onclick = async ()=>{
    const idx = Number(b.dataset.delTask); const tasks=[...(e.currentTasks||[])]; tasks.splice(idx,1);
    await dbUpdate("employees", e.id, {currentTasks:tasks}); refreshDrawerAfterMutate(e.id);
  });
  root.querySelectorAll(".task-status-sel").forEach(sel=> sel.onchange = async ()=>{
    const idx = Number(sel.dataset.taskIdx); const tasks=[...(e.currentTasks||[])]; tasks[idx]={...tasks[idx], status:sel.value, updatedDate:todayISO()};
    await dbUpdate("employees", e.id, {currentTasks:tasks}); refreshDrawerAfterMutate(e.id);
  });

  // resume
  bindClick(root,"[data-add-edu]", ()=>openResumeItemModal(e,"education"));
  bindClick(root,"[data-add-career]", ()=>openResumeItemModal(e,"careerHistory"));
  bindClick(root,"[data-add-cert]", ()=>openSimpleTextModal(e,"certifications","자격증 추가","자격증명"));
  bindClick(root,"[data-add-skill]", ()=>openSimpleTextModal(e,"skills","스킬 추가","스킬명"));
  root.querySelectorAll("[data-del-edu]").forEach(b=> b.onclick=()=>removeResumeItem(e,"education",Number(b.dataset.delEdu)));
  root.querySelectorAll("[data-del-career]").forEach(b=> b.onclick=()=>removeResumeItem(e,"careerHistory",Number(b.dataset.delCareer)));
  root.querySelectorAll("[data-del-cert]").forEach(b=> b.onclick=()=>removeResumeItem(e,"certifications",Number(b.dataset.delCert)));
  root.querySelectorAll("[data-del-skill]").forEach(b=> b.onclick=()=>removeResumeItem(e,"skills",Number(b.dataset.delSkill)));

  // project eval
  bindClick(root,"[data-add-projeval]", ()=>openProjectEvalModal(e));
  root.querySelectorAll("[data-del-projeval]").forEach(b=> b.onclick=async()=>{ if(await confirmDialog("평가 삭제","해당 프로젝트 평가를 삭제할까요?")){ await dbDelete("project_evaluations", b.dataset.delProjeval); refreshDrawerAfterMutate(e.id);} });

  // annual eval
  bindClick(root,"[data-add-annualeval]", ()=>openAnnualEvalModal(e));
  root.querySelectorAll("[data-del-annualeval]").forEach(b=> b.onclick=async()=>{ if(await confirmDialog("평가 삭제","해당 연간 평가를 삭제할까요?")){ await dbDelete("annual_evaluations", b.dataset.delAnnualeval); refreshDrawerAfterMutate(e.id);} });

  // regular eval (상시 평가, 무기명)
  bindClick(root,"[data-add-regulareval]", ()=>openRegularEvalModal(e));
  root.querySelectorAll("[data-del-regulareval]").forEach(b=> b.onclick=async()=>{ if(await confirmDialog("평가 삭제","해당 상시 평가를 삭제할까요?")){ await dbDelete("regular_evaluations", b.dataset.delRegulareval); refreshDrawerAfterMutate(e.id);} });

  // contracts
  bindClick(root,"[data-add-contract]", ()=>openContractModal(e));
  root.querySelectorAll("[data-del-contract]").forEach(b=> b.onclick=async()=>{ if(await confirmDialog("계약 삭제","해당 계약 기록을 삭제할까요?")){ await dbDelete("contracts", b.dataset.delContract); await syncEmployeeContractFields(e.id); refreshDrawerAfterMutate(e.id);} });
  root.querySelectorAll("[data-contract-status]").forEach(sel=> sel.onchange = async ()=>{
    const id = sel.dataset.contractStatus;
    const prev = (state.contracts.find(c=>c.id===id)||{}).status;
    const next = sel.value;
    if(next === prev) return;
    await dbUpdate("contracts", id, { status: next });
    toast(`계약 상태가 "${next}"(으)로 변경되었습니다.`);
    refreshDrawerAfterMutate(e.id);
  });

  // probation
  const startBtn = root.querySelector("[data-start-probation]");
  if(startBtn) startBtn.onclick = async ()=>{
    const start = todayISO();
    await dbUpdate("employees", e.id, {status:"수습", probation:{startDate:start, endDate:addMonths(start,3), finalDecision:"대기", evaluations:[]}});
    toast("수습이 시작되었습니다. 재직상태가 \"수습\"으로 설정되었습니다.");
    refreshDrawerAfterMutate(e.id);
  };
  bindClick(root,"[data-add-probation-eval]", ()=>openProbationEvalModal(e));
  root.querySelectorAll("[data-del-probation-eval]").forEach(b=> b.onclick=async()=>{
    if(await confirmDialog("평가 삭제","이 평가 기록을 삭제할까요?")){
      const p = e.probation || {};
      const evaluations = [...(p.evaluations||[])]; evaluations.splice(Number(b.dataset.delProbationEval),1);
      await dbUpdate("employees", e.id, {probation:{...p, evaluations}});
      refreshDrawerAfterMutate(e.id);
    }
  });
  const saveProbationBtn = root.querySelector("[data-save-probation]");
  if(saveProbationBtn) saveProbationBtn.onclick = async ()=>{
    const finalDecision = byId("finalDecisionSel").value;
    const patch = {
      finalDecision,
      finalDecisionDate: byId("finalDecisionDate").value,
      finalComment: byId("finalComment").value.trim(),
    };
    const empPatch = { probation: {...e.probation, ...patch} };
    if(finalDecision==="합격" && e.status==="수습") empPatch.status = "근무";
    await dbUpdate("employees", e.id, empPatch);
    toast(finalDecision==="합격" ? "합격 처리되었습니다. 재직상태가 \"근무\"로 전환되었습니다." : "최종 판정이 저장되었습니다.");
    refreshDrawerAfterMutate(e.id);
  };

}
export function bindClick(root, sel, fn){ const el = root.querySelector(sel); if(el) el.onclick = fn; }
export function refreshDrawerAfterMutate(empId){
  // 저장 직후 직원 상세 화면이 즉시 최신 상태를 반영하도록 다시 그린다.
  // (store 의 dbUpdate 도 렌더를 요청하지만, 서랍이 열린 채 중첩 필드만 바뀌는
  //  경우가 있어 호출부에서 명시적으로 한 번 더 요청한다.)
  renderRoute();
}

/* ---- sub-modals used from the drawer ---- */
export function openEditProfileModal(e){
  openModal("기본정보 수정", employeeFormFields(e), `
    <button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveEditEmp">저장</button>
  `);
  bindLeaveProgramToggle();
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveEditEmp").onclick = async ()=>{
    const data = readEmployeeForm();
    if(!data.name){ toast("이름을 입력해 주세요."); return; }
    // 재직상태를 "수습" 으로 바꿨으면 수습 정보를 채운다.
    // 이미 시작한 수습은 ensureProbationInfo 가 건드리지 않는다.
    await dbUpdate("employees", e.id, ensureProbationInfo({ ...e, ...data }));
    closeOverlay(); toast("저장되었습니다."); openEmployeeDrawer(e.id, "profile");
  };
}
export function openAddTaskModal(e){
  openModal("담당 업무 추가", `
    <div class="form-grid single">
      <div class="field"><label>업무명 *</label><input id="t_task" placeholder="예: Ai 365 대시보드 유지보수"></div>
      <div class="field"><label>상태</label><select id="t_status">${["진행중","완료","보류"].map(s=>`<option>${s}</option>`).join("")}</select></div>
    </div>`, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveTask">추가</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveTask").onclick = async ()=>{
    const task = byId("t_task").value.trim(); if(!task){ toast("업무명을 입력해 주세요."); return; }
    const tasks = [...(e.currentTasks||[]), {task, status:byId("t_status").value, updatedDate:todayISO()}];
    await dbUpdate("employees", e.id, {currentTasks:tasks});
    closeOverlay(); openEmployeeDrawer(e.id, "profile");
  };
}
export function openResumeItemModal(e, kind){
  const isEdu = kind==="education";
  openModal(isEdu?"학력 추가":"경력 추가", isEdu ? `
    <div class="form-grid">
      <div class="field"><label>학교명 *</label><input id="r_school"></div>
      <div class="field"><label>전공</label><input id="r_major"></div>
      <div class="field"><label>학위</label><input id="r_degree" placeholder="학사/석사/박사"></div>
      <div class="field"><label>졸업연도</label><input id="r_gradYear"></div>
    </div>` : `
    <div class="form-grid">
      <div class="field"><label>회사명 *</label><input id="r_company"></div>
      <div class="field"><label>직책/역할</label><input id="r_role"></div>
      <div class="field"><label>재직기간</label><input id="r_period" placeholder="예: 2019.03 - 2022.06"></div>
      <div class="field"><label>설명</label><input id="r_description"></div>
    </div>`, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveResumeItem">추가</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveResumeItem").onclick = async ()=>{
    const r = e.resume || {education:[], careerHistory:[], certifications:[], skills:[]};
    let item;
    if(isEdu){ item = {school:byId("r_school").value.trim(), major:byId("r_major").value.trim(), degree:byId("r_degree").value.trim(), gradYear:byId("r_gradYear").value.trim()}; if(!item.school){ toast("학교명을 입력해 주세요."); return; } }
    else { item = {company:byId("r_company").value.trim(), role:byId("r_role").value.trim(), period:byId("r_period").value.trim(), description:byId("r_description").value.trim()}; if(!item.company){ toast("회사명을 입력해 주세요."); return; } }
    const list = [...(r[kind]||[]), item];
    await dbUpdate("employees", e.id, {resume:{...r, [kind]:list}});
    closeOverlay(); openEmployeeDrawer(e.id, "resume");
  };
}
export function openSimpleTextModal(e, kind, title, placeholder){
  openModal(title, `<div class="field"><label>${esc(placeholder)}</label><input id="simpleTextInput"></div>`, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveSimpleText">추가</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveSimpleText").onclick = async ()=>{
    const v = byId("simpleTextInput").value.trim(); if(!v) { toast("값을 입력해 주세요."); return; }
    const r = e.resume || {education:[], careerHistory:[], certifications:[], skills:[]};
    const list = [...(r[kind]||[]), v];
    await dbUpdate("employees", e.id, {resume:{...r, [kind]:list}});
    closeOverlay(); openEmployeeDrawer(e.id, "resume");
  };
}
export async function removeResumeItem(e, kind, idx){
  const r = e.resume || {}; const list = [...(r[kind]||[])]; list.splice(idx,1);
  await dbUpdate("employees", e.id, {resume:{...r, [kind]:list}});
  openEmployeeDrawer(e.id, "resume");
}

export function openProjectEvalModal(e){
  const standalone = !e;
  const empOptions = standalone ? contractedEmployees().map(emp=>`<option value="${esc(emp.id)}">${esc(emp.name)} · ${esc(emp.division||"사업부 미정")}</option>`).join("") : "";
  const projOptions = state.projects.map(p=>`<option value="${esc(p.id)}" data-name="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  openModal("프로젝트 평가 등록", `
    <div class="form-grid">
      ${standalone ? `<div class="field span2"><label>직원 *</label><select id="pe_employee"><option value="">직원 선택 (계약 관리 등록 인원만 표시)</option>${empOptions}</select></div>` : ""}
      <div class="field span2"><label>프로젝트</label><select id="pe_project"><option value="">직접 입력</option>${projOptions}</select></div>
      <div class="field span2"><label>프로젝트명 (직접 입력 시)</label><input id="pe_projectName"></div>
      <div class="field"><label>투입 역할</label><input id="pe_role"></div>
      <div class="field"><label>투입 기간</label><input id="pe_period" placeholder="예: 2026.01 - 2026.06"></div>
      <div class="field"><label>점수 (0~100)</label><input type="number" min="0" max="100" id="pe_score" value="80"></div>
      <div class="field"><label>평가자 *</label><input id="pe_evaluator" placeholder="평가자 이름"></div>
      <div class="field"><label>평가일</label><input type="date" id="pe_date" value="${todayISO()}"></div>
      <div class="field span2"><label>강점</label><textarea id="pe_strengths" rows="2"></textarea></div>
      <div class="field span2"><label>개선점</label><textarea id="pe_improvements" rows="2"></textarea></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="savePE">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("savePE").onclick = async ()=>{
    let emp = e;
    if(standalone){
      const empId = byId("pe_employee").value;
      if(!empId){ toast("직원을 선택해 주세요."); return; }
      emp = empById(empId);
      if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    }
    const sel = byId("pe_project"); const projName = byId("pe_projectName").value.trim() || (sel.selectedOptions[0] && sel.selectedOptions[0].dataset.name) || "";
    if(!projName){ toast("프로젝트명을 입력하거나 선택해 주세요."); return; }
    const evaluator = byId("pe_evaluator").value.trim();
    if(!evaluator){ toast("평가자를 입력해 주세요."); return; }
    await dbAdd("project_evaluations", {
      employeeId:emp.id, employeeName:emp.name, projectId: sel.value||"", projectName:projName,
      role:byId("pe_role").value.trim(), period:byId("pe_period").value.trim(),
      score:Number(byId("pe_score").value)||0, evaluator, evalDate:byId("pe_date").value,
      strengths:byId("pe_strengths").value.trim(), improvements:byId("pe_improvements").value.trim(),
    });
    closeOverlay();
    if(standalone){ ui.evalTab = "project"; setRoute("evaluations"); } else { openEmployeeDrawer(emp.id, "projectEval"); }
  };
}

export function openAnnualEvalModal(e){
  const standalone = !e;
  const empOptions = standalone ? contractedEmployees().map(emp=>`<option value="${esc(emp.id)}">${esc(emp.name)} · ${esc(emp.division||"사업부 미정")}</option>`).join("") : "";
  const y = new Date().getFullYear();
  const itemsHtml = evalItemsHtml("ae");
  openModal("연간 평가 등록", `
    <div class="form-grid">
      ${standalone ? `<div class="field span2"><label>직원 *</label><select id="ae_employee"><option value="">직원 선택 (계약 관리 등록 인원만 표시)</option>${empOptions}</select></div>` : ""}
      <div class="field"><label>평가 연도</label><input type="number" id="ae_year" value="${y}"></div>
      <div class="field"><label>등급</label><select id="ae_grade">${["S","A","B","C","D"].map(g=>`<option>${g}</option>`).join("")}</select></div>
      <div class="field"><label>종합 점수 (0~100)</label><input type="number" min="0" max="100" id="ae_score" value="80"></div>
      <div class="field"><label>평가자 *</label><input id="ae_evaluator" placeholder="평가자 이름"></div>
      <div class="field"><label>평가일</label><input type="date" id="ae_date" value="${todayISO()}"></div>
    </div>
    <div class="form-grid" style="margin-top:10px;">
      ${itemsHtml}
      <div class="field span2"><label>코멘트</label><textarea id="ae_comment" rows="2"></textarea></div>
      <div class="field span2"><label>승진 의견</label><textarea id="ae_promotion" rows="2" placeholder="승진 대상 여부 및 의견"></textarea></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveAE">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveAE").onclick = async ()=>{
    let emp = e;
    if(standalone){
      const empId = byId("ae_employee").value;
      if(!empId){ toast("직원을 선택해 주세요."); return; }
      emp = empById(empId);
      if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    }
    const evaluator = byId("ae_evaluator").value.trim();
    if(!evaluator){ toast("평가자를 입력해 주세요."); return; }
    await dbAdd("annual_evaluations", {
      employeeId:emp.id, employeeName:emp.name, year:Number(byId("ae_year").value)||y,
      grade:byId("ae_grade").value, score:Number(byId("ae_score").value)||0, evaluator,
      items: readEvalItems("ae"),
      evalDate:byId("ae_date").value, comment:byId("ae_comment").value.trim(),
      promotionOpinion: byId("ae_promotion").value.trim(),
    });
    closeOverlay();
    if(standalone){ ui.evalTab = "annual"; setRoute("evaluations"); } else { openEmployeeDrawer(emp.id, "annualEval"); }
  };
}

export function openRegularEvalModal(e){
  const standalone = !e;
  const empOptions = standalone ? [...state.employees].filter(emp=>emp.status!=="퇴사").sort((a,b)=>(a.name||"").localeCompare(b.name||"","ko")).map(emp=>`<option value="${esc(emp.id)}">${esc(emp.name)} · ${esc(emp.division||"사업부 미정")}</option>`).join("") : "";
  const itemsHtml = evalItemsHtml("re");
  openModal("상시 평가 등록", `
    <div class="field span2 hint" style="background:var(--accent-soft); border:1px solid var(--accent); border-radius:8px; padding:10px 12px; margin-bottom:14px; color:var(--text);">
      무기명 평가입니다. 평가자 정보는 입력받지 않으며 저장되지 않습니다.
    </div>
    <div class="form-grid">
      ${standalone ? `<div class="field span2"><label>대상 직원 *</label><select id="re_employee"><option value="">직원 선택</option>${empOptions}</select></div>` : ""}
      <div class="field"><label>평가일</label><input type="date" id="re_date" value="${todayISO()}"></div>
      <div class="field"><label>등급</label><select id="re_grade">${["S","A","B","C","D"].map(g=>`<option>${g}</option>`).join("")}</select></div>
    </div>
    <div class="form-grid" style="margin-top:10px;">
      ${itemsHtml}
      <div class="field span2"><label>종합 코멘트</label><textarea id="re_comment" rows="2"></textarea></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveRE">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveRE").onclick = async ()=>{
    let emp = e;
    if(standalone){
      const empId = byId("re_employee").value;
      if(!empId){ toast("대상 직원을 선택해 주세요."); return; }
      emp = empById(empId);
      if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    }
    await dbAdd("regular_evaluations", {
      employeeId:emp.id, employeeName:emp.name,
      evalDate:byId("re_date").value, grade:byId("re_grade").value,
      items: readEvalItems("re"),
      comment:byId("re_comment").value.trim(),
    });
    closeOverlay();
    toast("무기명 상시 평가가 등록되었습니다.");
    if(standalone){ ui.evalTab = "regular"; setRoute("evaluations"); } else { openEmployeeDrawer(emp.id, "regularEval"); }
  };
}

/**
 * 계약을 등록하면 직원 마스터의 "최종 계약일 · 현재 연봉" 도 같이 맞춘다.
 * ---------------------------------------------------------
 * 계약 관리 화면의 대기 리스트는 계약 문서가 아니라 직원 마스터의
 * lastContractDate 를 기준으로 계산한다(contractRenewalDueList).
 * 예전에는 "계약 입력"(갱신) 경로에서만 이 필드를 갱신해서, "계약 등록"
 * 으로 넣은 계약은 이력에는 보이는데 계약 관리 화면에는 나타나지 않았다.
 *
 * 재계산은 domain/hr.js 의 syncEmployeeContractFields 가 맡는다 — 계약이
 * 원천이고 직원 필드는 거기서 파생된다.
 */

/** 연봉 입력칸 아래에 현재 연봉을 보여 준다 (무엇을 바꾸는지 알 수 있게) */
function currentSalaryHint(emp){
  return emp.currentSalary
    ? `현재 연봉 ${fmtWon(emp.currentSalary)} — 바꾸면 이 계약의 연봉이 직원의 현재 연봉이 됩니다.`
    : "등록된 연봉이 없습니다. 입력한 값이 직원의 현재 연봉이 됩니다.";
}

export function openContractModal(e){
  const standalone = !e;
  const sortedEmps = standalone ? [...state.employees].sort((a,b)=>(a.name||"").localeCompare(b.name||"","ko")) : [];
  // 사업부 목록은 실제로 등록된 값에서 뽑는다 (상수 목록에 없는 값도 잡히게)
  const empDivisions = [...new Set(sortedEmps.map(x=> x.division || "사업부 미정"))].sort((a,b)=>a.localeCompare(b,"ko"));
  const typeOptions = (sel)=> ["정규직 근로계약","연봉계약","수습계약","계약직 근로계약","프리랜서 계약"]
    .map(t=>`<option ${sel===t?"selected":""}>${t}</option>`).join("");

  openModal("계약 등록", `
    <div class="form-grid">
      ${standalone ? `
      <!-- 인원이 많아지면 드롭다운 하나로는 못 찾는다. 사업부와 이름으로 먼저 좁힌다. -->
      <div class="field"><label>사업부</label>
        <select id="c_empDivision"><option value="">전체 사업부</option>${empDivisions.map(d=>`<option>${esc(d)}</option>`).join("")}</select>
      </div>
      <div class="field"><label>이름 검색</label>
        <input id="c_empSearch" placeholder="이름 또는 사번" autocomplete="off">
      </div>
      <div class="field span2"><label>직원 *</label><select id="c_employee"></select>
        <div class="hint" id="c_empHint">직원을 선택하면 현재 연봉과 계약 구분이 채워집니다.</div>
      </div>` : ""}
      <div class="field span2"><label>계약 구분</label><select id="c_type">${typeOptions(e ? contractTypeFor(e.employmentType) : null)}</select></div>
      <div class="field"><label>계약 시작일</label><input type="date" id="c_start" value="${todayISO()}"></div>
      <div class="field"><label>계약 종료일</label><input type="date" id="c_end"></div>
      <div class="field"><label>연봉 (만원) *</label><input type="number" id="c_salary" value="${esc(e && e.currentSalary ? e.currentSalary : "")}"><div class="hint" id="c_salaryHint">${e ? currentSalaryHint(e) : "직원을 먼저 선택하세요."}</div></div>
      <div class="field"><label>사이닝보너스 (만원)</label><input type="number" id="c_signingBonus"></div>
      <div class="field"><label>채용 수수료 (만원)</label><input type="number" id="c_recruitingFee"></div>
      <div class="field"><label>변경 사유</label><select id="c_reason">${["신규","연봉인상","연장","재계약","조정"].map(t=>`<option>${t}</option>`).join("")}</select></div>
      <div class="field"><label>서명일</label><input type="date" id="c_signed" value="${todayISO()}"></div>
      <div class="field"><label>상태</label><select id="c_status">${["대기","지연","완료"].map(t=>`<option>${t}</option>`).join("")}</select></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveContract">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;

  // 계약 관리 화면에서 열었을 때 — 직원을 고르면 현재 연봉과 계약 구분을 채운다.
  // 빈 채로 저장하면 연봉이 0으로 기록되고, 직원 연봉까지 0으로 덮인다.
  const empSel = byId("c_employee");
  const applyPicked = ()=>{
    const picked = empById(empSel.value);
    const salaryEl = byId("c_salary");
    const hintEl = byId("c_salaryHint");
    if(!picked){
      salaryEl.value = "";
      if(hintEl) hintEl.textContent = "직원을 먼저 선택하세요.";
      return;
    }
    salaryEl.value = picked.currentSalary || "";
    byId("c_type").value = contractTypeFor(picked.employmentType);
    if(hintEl) hintEl.textContent = currentSalaryHint(picked);
  };

  if(empSel){
    const divSel = byId("c_empDivision");
    const searchEl = byId("c_empSearch");
    const hintEl = byId("c_empHint");

    const refreshEmpOptions = ()=>{
      const div = divSel ? divSel.value : "";
      const q = (searchEl ? searchEl.value : "").trim().toLowerCase();
      const list = sortedEmps.filter(x=>{
        if(div && (x.division || "사업부 미정") !== div) return false;
        if(!q) return true;
        return (x.name||"").toLowerCase().includes(q) || (x.empNo||"").toLowerCase().includes(q);
      });
      const keep = empSel.value;
      empSel.innerHTML = `<option value="">${list.length ? "직원 선택" : "조건에 맞는 직원이 없습니다"}</option>`
        + list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.division||"사업부 미정")}${x.empNo?` · ${esc(x.empNo)}`:""}</option>`).join("");
      // 좁히기 전에 고른 직원이 아직 목록에 있으면 선택을 유지한다.
      if(keep && list.some(x=>x.id===keep)) empSel.value = keep;
      if(hintEl) hintEl.textContent = `${list.length}명 중에서 선택 · 직원을 선택하면 현재 연봉과 계약 구분이 채워집니다.`;
      if(empSel.value !== keep) applyPicked();
    };

    if(divSel) divSel.onchange = refreshEmpOptions;
    if(searchEl) searchEl.oninput = refreshEmpOptions;
    empSel.onchange = applyPicked;
    refreshEmpOptions();
  }

  byId("saveContract").onclick = async ()=>{
    let emp = e;
    if(standalone){
      const empId = byId("c_employee").value;
      if(!empId){ toast("직원 마스터에서 직원을 선택해 주세요."); return; }
      emp = empById(empId);
      if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    }
    const start = byId("c_start").value;
    if(!start){ toast("계약 시작일을 입력해 주세요."); return; }
    const salary = Number(byId("c_salary").value)||0;
    // 연봉은 계약에서만 정해진다. 빈 값을 허용하면 직원 연봉이 0으로 덮인다.
    if(salary <= 0){ toast("연봉을 입력해 주세요. 이 값이 직원의 현재 연봉이 됩니다."); return; }
    await dbAdd("contracts", {
      employeeId:emp.id, employeeName:emp.name, contractType:byId("c_type").value,
      startDate:start, endDate:byId("c_end").value,
      annualSalary:salary,
      signingBonus:Number(byId("c_signingBonus").value)||0,
      recruitingFee:Number(byId("c_recruitingFee").value)||0,
      changeReason:byId("c_reason").value,
      signedDate:byId("c_signed").value, status:byId("c_status").value,
    });
    await syncEmployeeContractFields(emp.id);
    closeOverlay();
    if(standalone){ setRoute("contracts"); } else { openEmployeeDrawer(emp.id, "contracts"); }
  };
}

export function openContractRenewalModal(e, oldContract){
  openModal(`${esc(e.name)} · 계약 입력`, `
    <div class="form-grid">
      <div class="field span2"><label>계약 구분</label><select id="cr_type">${["정규직 근로계약","연봉계약","수습계약","계약직 근로계약","프리랜서 계약"].map(t=>`<option ${oldContract&&oldContract.contractType===t?"selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label>계약 시작일</label><input type="date" id="cr_start" value="${todayISO()}"></div>
      <div class="field"><label>계약 종료일</label><input type="date" id="cr_end"></div>
      <div class="field"><label>연봉 (만원)</label><input type="number" id="cr_salary" value="${esc((oldContract&&oldContract.annualSalary)||"")}"></div>
      <div class="field"><label>사이닝보너스 (만원)</label><input type="number" id="cr_signingBonus"></div>
      <div class="field"><label>채용 수수료 (만원)</label><input type="number" id="cr_recruitingFee"></div>
      <div class="field"><label>변경 사유</label><select id="cr_reason">${["재계약","연장","연봉인상","조정","신규"].map(t=>`<option>${t}</option>`).join("")}</select></div>
      <div class="field"><label>서명일</label><input type="date" id="cr_signed" value="${todayISO()}"></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveContractRenewal">저장 · 완료 처리</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveContractRenewal").onclick = async ()=>{
    const start = byId("cr_start").value;
    if(!start){ toast("계약 시작일을 입력해 주세요."); return; }
    const salary = Number(byId("cr_salary").value)||0;
    // 연봉은 계약에서만 정해진다. 빈 값을 허용하면 직원 연봉이 0으로 덮인다.
    if(salary <= 0){ toast("연봉을 입력해 주세요. 이 값이 직원의 현재 연봉이 됩니다."); return; }
    await dbAdd("contracts", {
      employeeId:e.id, employeeName:e.name, contractType:byId("cr_type").value,
      startDate:start, endDate:byId("cr_end").value,
      annualSalary:salary,
      signingBonus:Number(byId("cr_signingBonus").value)||0,
      recruitingFee:Number(byId("cr_recruitingFee").value)||0,
      changeReason:byId("cr_reason").value,
      signedDate:byId("cr_signed").value, status:"완료",
      renewalStatus:"완료",
    });
    await syncEmployeeContractFields(e.id);
    closeOverlay();
    toast("계약 사항이 등록되고 인력 마스터에 반영되었습니다.");
    setRoute("contracts");
  };
}

export function evalItemsHtml(prefix){
  const gradeOpts = ["A","B","C","D"].map(g=>`<option>${g}</option>`).join("");
  return EVAL_ITEMS.map((it,i)=>`
    <div class="field span2" style="border:1px solid var(--border); border-radius:8px; padding:10px 12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
        <label style="margin:0;">${esc(it.key)} <span class="hint">${esc(it.desc)}</span></label>
        <select id="${prefix}_grade_${i}">${gradeOpts}</select>
      </div>
      <textarea id="${prefix}_comment_${i}" rows="2" placeholder="평가자 의견"></textarea>
    </div>
  `).join("");
}
export function readEvalItems(prefix){
  return EVAL_ITEMS.map((it,i)=>({ key: it.key, grade: byId(`${prefix}_grade_${i}`).value, comment: byId(`${prefix}_comment_${i}`).value.trim() }));
}

export function probationEvalFieldsHtml(prefix, opts){
  opts = opts || {};
  const itemsHtml = evalItemsHtml(prefix);
  return `
    <div class="form-grid">
      <div class="field"><label>평가자 *</label><input id="${prefix}_evaluator" placeholder="평가자 이름" value="${esc(opts.evaluator||"")}"></div>
      <div class="field"><label>평가일</label><input type="date" id="${prefix}_date" value="${esc(opts.date||todayISO())}"></div>
      <div class="field"><label>등급</label><select id="${prefix}_grade">${["S","A","B","C","D"].map(g=>`<option ${opts.grade===g?"selected":""}>${g}</option>`).join("")}</select></div>
      <div class="field"><label>종합 점수 (0~100)</label><input type="number" min="0" max="100" id="${prefix}_score" value="${esc(opts.score??80)}"></div>
    </div>
    <div class="form-grid" style="margin-top:10px;">
      ${itemsHtml}
      <div class="field span2"><label>코멘트</label><textarea id="${prefix}_comment" rows="2">${esc(opts.comment||"")}</textarea></div>
      <div class="field span2"><label>정규직 전환 의견</label><select id="${prefix}_final">
        <option value="정규직 전환 권고" ${opts.finalOpinion==="정규직 전환 권고"?"selected":""}>정규직 전환 권고</option>
        <option value="정규직 전환 비권고" ${opts.finalOpinion==="정규직 전환 비권고"?"selected":""}>정규직 전환 비권고</option>
      </select></div>
    </div>
  `;
}
export function readProbationEvalFields(prefix){
  return {
    evaluator: byId(`${prefix}_evaluator`).value.trim(),
    date: byId(`${prefix}_date`).value,
    grade: byId(`${prefix}_grade`).value,
    score: Number(byId(`${prefix}_score`).value)||0,
    items: readEvalItems(prefix),
    comment: byId(`${prefix}_comment`).value.trim(),
    finalOpinion: byId(`${prefix}_final`).value,
  };
}
export function openProbationEvalModal(e, opts){
  opts = opts || {};
  const fromProbationList = !!opts.fromProbationList;
  const standalone = !e;
  const empOptions = standalone ? contractedEmployees().filter(x=>x.status==="수습").map(emp=>`<option value="${esc(emp.id)}">${esc(emp.name)} · ${esc(emp.division||"사업부 미정")}</option>`).join("") : "";
  openModal("수습 평가 등록", `
    ${standalone ? `<div class="form-grid"><div class="field span2"><label>직원 *</label><select id="pv_employee"><option value="">직원 선택 (계약 관리 등록된 수습 인원만 표시)</option>${empOptions}</select></div></div>` : ""}
    ${probationEvalFieldsHtml("pv")}
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="savePV">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("savePV").onclick = async ()=>{
    let emp = e;
    if(standalone){
      const empId = byId("pv_employee").value;
      if(!empId){ toast("직원을 선택해 주세요."); return; }
      emp = empById(empId);
      if(!emp){ toast("직원 정보를 찾을 수 없습니다."); return; }
    }
    const fields = readProbationEvalFields("pv");
    if(!fields.evaluator){ toast("평가자를 입력해 주세요."); return; }
    const p = emp.probation || {};
    const evaluations = [...(p.evaluations||[]), fields];
    if(fromProbationList){
      const finalDecision = fields.finalOpinion === "정규직 전환 권고" ? "합격" : "불합격";
      const patch = { probation:{...p, evaluations, finalDecision, finalDecisionDate: todayISO()} };
      if(finalDecision==="합격" && emp.status==="수습") patch.status = "근무";
      await dbUpdate("employees", emp.id, patch);
      closeOverlay();
      setRoute("probation");
      toast("평가가 저장되었습니다. \""+emp.name+"\"님이 "+finalDecision+" 처리되어 완료 목록으로 이동했습니다.");
      return;
    }
    await dbUpdate("employees", emp.id, {probation:{...p, evaluations}});
    closeOverlay();
    if(standalone){ setRoute("probation"); } else { openEmployeeDrawer(emp.id, "probation"); }
  };
}
export function openProbationEvalViewModal(e){
  const p = e.probation || {};
  openModal(`${esc(e.name)} · 수습 평가 보기`, `
    <div class="stat-mini-grid" style="margin-bottom:18px;">
      <div class="stat-mini"><div class="v">${fmtDate(p.startDate)}</div><div class="l">수습 시작일</div></div>
      <div class="stat-mini"><div class="v">${fmtDate(p.endDate)}</div><div class="l">수습 종료일(3개월)</div></div>
      <div class="stat-mini"><div class="v">${pill(p.finalDecision||"대기", p.finalDecision==="합격"?"success":p.finalDecision==="불합격"?"danger":p.finalDecision==="지연"?"warning":"muted")}</div><div class="l">최종 판정</div></div>
      <div class="stat-mini"><div class="v">${fmtDate(p.finalDecisionDate)||"—"}</div><div class="l">판정일</div></div>
    </div>
    ${p.finalComment ? `<div class="t2" style="margin-bottom:14px;"><b>최종 코멘트</b> ${esc(p.finalComment)}</div>` : ""}
    <div class="subhead"><h4>평가 이력</h4></div>
    ${renderProbationEvalList(p.evaluations, {withDelete:false})}
  `, `<button class="btn btn-primary" data-cancel>닫기</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
}
