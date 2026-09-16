import { saveBlob } from "../core/download.js";
import { byId, esc, todayISO } from "../core/format.js";
import { setRoute } from "../core/router.js";
import { dbAdd, state } from "../data/store.js";
import { exportRowsToExcel, fillSheetWithValidation, mapImportRow } from "./excel-employees.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
export const SUBSIDY_PROGRAM_IMPORT_COLS = [
  {header:"항목명(프로그램명)", field:"name", type:"text", required:true},
  {header:"기본 지원 금액(만원)", field:"amount", type:"number"},
  {header:"지원 기간(개월)", field:"months", type:"number"},
  {header:"비고", field:"notes", type:"text"},
];
export async function exportSubsidyProgramsExcel(){
  const rows = [...state.subsidyPrograms].sort((a,b)=> (a.name||"").localeCompare(b.name||"", "ko"));
  await exportRowsToExcel(`지원금_마스터_${todayISO().replaceAll("-","")}.xlsx`, "지원금항목", SUBSIDY_PROGRAM_IMPORT_COLS, rows);
}
export const SAMPLE_SUBSIDY_PROGRAM_ROWS = [
  ["청년내일채움공제", 1200, 24, "청년 정규직 채용 지원금"],
  ["고용안정장려금", 720, 12, "월 60만원 x 12개월 지원"],
];
export function buildSubsidyProgramSampleWorkbookPlain(){
  const aoa = [SUBSIDY_PROGRAM_IMPORT_COLS.map(c=>c.header), ...SAMPLE_SUBSIDY_PROGRAM_ROWS];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "지원금항목");
  return wb;
}
export async function buildSubsidyProgramSampleWorkbookXlsx(){
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("지원금항목");
  fillSheetWithValidation(sheet, SUBSIDY_PROGRAM_IMPORT_COLS, SAMPLE_SUBSIDY_PROGRAM_ROWS, 200);
  return wb;
}
export async function downloadSubsidyProgramSampleExcel(){
  let blob;
  if(typeof ExcelJS!=="undefined"){
    try{
      const wb = await buildSubsidyProgramSampleWorkbookXlsx();
      const arrbuf = await wb.xlsx.writeBuffer();
      blob = new Blob([arrbuf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    }catch(err){
      blob = null;
    }
  }
  if(!blob){
    if(typeof XLSX==="undefined"){ toast("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
    const wb = buildSubsidyProgramSampleWorkbookPlain();
    const arrbuf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    blob = new Blob([arrbuf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    toast("샘플 엑셀 파일을 생성합니다.");
  }
  try{
    await saveBlob("지원금_마스터_업로드_샘플.xlsx", blob);
    toast("샘플 엑셀 파일을 내려받았습니다.");
  }catch(err){
    toast("샘플 파일 저장에 실패했습니다.");
  }
}
export let importSubsidyProgramParsed = null; // {items:[...], errors:[...]}
export function renderSubsidyProgramImportPreview(){
  const box = byId("importSubsidyProgramPreviewBox");
  if(!box) return;
  if(!importSubsidyProgramParsed){ box.innerHTML = ""; return; }
  const {items, errors} = importSubsidyProgramParsed;
  const errLines = errors.slice(0,10);
  box.innerHTML = `
    <div class="stat-mini-grid" style="grid-template-columns:1fr; margin-top:14px;">
      <div class="stat-mini"><div class="v">${items.length}</div><div class="l">지원금 항목 · 업로드 가능</div></div>
    </div>
    ${errLines.length ? `<div class="field hint" style="margin-top:10px; color:var(--danger);">${errLines.map(e=>esc(e)).join("<br>")}${errors.length>10?`<br>외 ${errors.length-10}건`:""}</div>` : ""}
  `;
  const uploadBtn = byId("confirmImportSubsidyProgramBtn");
  if(uploadBtn) uploadBtn.disabled = items.length===0;
}
export async function handleImportSubsidyProgramFile(file){
  if(typeof XLSX==="undefined"){ toast("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:"array"});
    const sheetName = wb.SheetNames.find(n=>n.trim()==="지원금항목") || wb.SheetNames[0];
    const sheetOpts = {defval:"", raw:false};
    const rowsRaw = sheetName ? XLSX.utils.sheet_to_json(wb.Sheets[sheetName], sheetOpts) : [];
    const items = []; const errors = [];
    rowsRaw.forEach((row,i)=>{
      const {data, missing} = mapImportRow(row, SUBSIDY_PROGRAM_IMPORT_COLS);
      if(missing.length){ errors.push(`${i+2}행: ${missing.join(", ")} 누락으로 건너뜀`); return; }
      items.push(data);
    });
    importSubsidyProgramParsed = {items, errors};
    renderSubsidyProgramImportPreview();
  }catch(err){
    toast("엑셀 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해 주세요.");
  }
}
export async function runSubsidyProgramImport(){
  if(!importSubsidyProgramParsed) return;
  const {items} = importSubsidyProgramParsed;
  for(const data of items){ await dbAdd("subsidy_programs", data); }
  closeOverlay();
  toast(`지원금 항목 ${items.length}건이 업로드되었습니다.`);
  importSubsidyProgramParsed = null;
  setRoute("subsidyPrograms");
}
export function openSubsidyProgramImportModal(){
  importSubsidyProgramParsed = null;
  openModal("엑셀로 지원금 마스터 업로드", `
    <div class="field hint" style="margin-bottom:12px;">'지원금항목' 시트로 구성된 엑셀 파일을 업로드해 주세요. 먼저 샘플 파일을 내려받아 형식을 확인하시는 것을 권장합니다.</div>
    <button class="btn btn-sm" id="downloadSubsidyProgramSampleBtn" type="button">${ICON.download}샘플 엑셀 다운로드</button>
    <div class="divider"></div>
    <div class="field"><label>엑셀 파일 선택 (.xlsx)</label><input type="file" id="importSubsidyProgramFileInput" accept=".xlsx"></div>
    <div id="importSubsidyProgramPreviewBox"></div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="confirmImportSubsidyProgramBtn" disabled>업로드</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("downloadSubsidyProgramSampleBtn").onclick = downloadSubsidyProgramSampleExcel;
  byId("importSubsidyProgramFileInput").onchange = (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if(file) handleImportSubsidyProgramFile(file);
  };
  byId("confirmImportSubsidyProgramBtn").onclick = runSubsidyProgramImport;
}
