import { byId, esc, fmtWon } from "../core/format.js";
import { setRoute } from "../core/router.js";
import { dbAdd, state } from "../data/store.js";
import { ui } from "../state/ui.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { emptyState } from "./dashboard.js";
export function renderSubsidyProgramsView(){
  if(ui.selectedSubsidyProgramId){
    const sel = state.subsidyPrograms.find(x=>x.id===ui.selectedSubsidyProgramId);
    if(sel) return renderSubsidyProgramDetailScreen(sel);
    ui.selectedSubsidyProgramId = null;
  }
  const items = [...state.subsidyPrograms].sort((a,b)=> (a.name||"").localeCompare(b.name||"", "ko"));
  return `
    <div class="topbar">
      <div><h1>지원금 마스터</h1><div class="desc">정부지원금 신청 시 선택할 지원 항목과 기본 금액·기간을 등록·관리합니다. 행을 클릭하면 등록 정보를 참조할 수 있습니다.</div></div>
      <div class="topbar-actions"><button class="btn" id="btnExportSubsidyPrograms">${ICON.download}다운로드</button><button class="btn" id="btnImportSubsidyProgramExcel">${ICON.upload}엑셀 업로드</button><button class="btn btn-primary" id="btnAddSubsidyProgram">${ICON.plus}지원금 항목 등록</button></div>
    </div>
    <div class="panel">
      ${items.length ? `<div class="table-scroll"><table>
        <thead><tr><th>항목명</th><th>기본 지원 금액(만원)</th><th>지원 기간(개월)</th><th>비고</th><th></th></tr></thead>
        <tbody>${items.map(p=>`
          <tr class="clickable" data-open-subsidy-program="${p.id}">
            <td class="cell-strong">${esc(p.name)}${p.isSample?'<span class="tag-sample">샘플</span>':""}</td>
            <td class="num">${fmtWon(p.amount)}</td>
            <td class="num">${p.months?p.months+"개월":"—"}</td>
            <td class="cell-muted">${esc(p.notes||"—")}</td>
            <td style="white-space:nowrap;"><button class="icon-btn" data-edit-subsidy-program="${p.id}">${ICON.edit}</button><button class="icon-btn" data-del-subsidy-program="${p.id}">${ICON.trash}</button></td>
          </tr>
        `).join("")}</tbody></table></div>` : emptyState("coin","등록된 지원금 항목이 없습니다. 신청 등록 시 사용할 항목·금액·기간을 먼저 등록해 주세요.")}
    </div>
  `;
}
export function subsidyProgramFormFields(p){
  p = p || {};
  return `
    <div class="form-grid">
      <div class="field span2"><label>항목명(프로그램명) *</label><input id="sp_name" value="${esc(p.name||"")}"></div>
      <div class="field"><label>기본 지원 금액(만원)</label><input type="number" id="sp_amount" value="${esc(p.amount??"")}"></div>
      <div class="field"><label>지원 기간(개월)</label><input type="number" id="sp_months" value="${esc(p.months??"")}"></div>
      <div class="field span2"><label>비고</label><textarea id="sp_notes" rows="2">${esc(p.notes||"")}</textarea></div>
    </div>
    <div class="field hint" style="margin-top:8px;">여기서 등록한 금액·기간은 지원금 관리 화면에서 신청 등록 시 항목을 선택하면 기본값으로 자동 입력됩니다.</div>
  `;
}
export function readSubsidyProgramForm(){
  return {
    name: byId("sp_name").value.trim(),
    amount: Number(byId("sp_amount").value)||0,
    months: Number(byId("sp_months").value)||0,
    notes: byId("sp_notes").value.trim(),
  };
}
export function renderSubsidyProgramDetailScreen(p){
  return `
    <div class="topbar">
      <div>
        <button class="btn btn-sm" data-close-detail="subsidyPrograms" style="margin-bottom:10px;">${ICON.back}목록으로</button>
        <h1>${esc(p.name)}</h1>
        <div class="desc">지원금 항목 등록 정보를 확인하고 수정할 수 있습니다.</div>
      </div>
      <div class="topbar-actions"><button class="btn btn-danger-ghost btn-sm" data-del-subsidy-program="${p.id}">${ICON.trash}삭제</button></div>
    </div>
    <div class="panel">
      <div class="panel-body">
        ${subsidyProgramFormFields(p)}
      </div>
      <div class="drawer-foot">
        <button class="btn" data-close-detail="subsidyPrograms">${ICON.back}목록으로</button>
        <button class="btn btn-primary" data-save-subsidy-program-detail="${p.id}">저장하기</button>
      </div>
    </div>
  `;
}
export function openSubsidyProgramModal(){
  openModal("지원금 항목 등록", subsidyProgramFormFields(), `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="saveSubsidyProgram">등록</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("saveSubsidyProgram").onclick = async ()=>{
    const data = readSubsidyProgramForm();
    if(!data.name){ toast("항목명을 입력해 주세요."); return; }
    await dbAdd("subsidy_programs", data);
    closeOverlay();
    toast("지원금 항목이 등록되었습니다.");
    setRoute("subsidyPrograms");
  };
}
