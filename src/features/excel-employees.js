import { DIVISION_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, LOCATION_OPTIONS, POSITION_OPTIONS, RECRUIT_TYPE_OPTIONS, SUBSIDY_EMP_STATUS_OPTIONS, WORK_TYPE_OPTIONS } from "../config/options.js";
import { saveBlob } from "../core/download.js";
import { byId, esc, todayISO } from "../core/format.js";
import { setRoute } from "../core/router.js";
import { dbAdd, state } from "../data/store.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { filteredEmployeesForMaster } from "../views/employees.js";
export const EMP_IMPORT_COLS = [
  {header:"이름", field:"name", type:"text", required:true},
  {header:"사번", field:"empNo", type:"text"},
  {header:"사업부", field:"division", type:"select", options:DIVISION_OPTIONS},
  {header:"직급/직책", field:"position", type:"select", options:POSITION_OPTIONS},
  {header:"고용형태", field:"employmentType", type:"select", options:EMPLOYMENT_TYPE_OPTIONS, def:"일반직"},
  {header:"재직상태", field:"status", type:"select", options:["수습","근무","퇴사"], def:"근무"},
  {header:"근무형태", field:"workType", type:"select", options:WORK_TYPE_OPTIONS, def:"일반근무"},
  {header:"채용타입", field:"recruitType", type:"select", options:RECRUIT_TYPE_OPTIONS, def:"정직원"},
  {header:"소속위치", field:"location", type:"select", options:LOCATION_OPTIONS, def:"한국"},
  {header:"생년월일", field:"birthDate", type:"date"},
  {header:"입사일", field:"hireDate", type:"date"},
  {header:"업무시작일", field:"workStartDate", type:"date"},
  {header:"연락처", field:"phone", type:"text"},
  {header:"이메일", field:"email", type:"text"},
  {header:"현재연봉(만원)", field:"currentSalary", type:"number"},
  {header:"최종계약일", field:"lastContractDate", type:"date"},
  {header:"지원금대상자", field:"subsidyEligible", type:"select", options:SUBSIDY_EMP_STATUS_OPTIONS, def:"아니오"},
];
export const CONTRACT_IMPORT_COLS = [
  {header:"직원이름", field:"employeeName", type:"text", required:true},
  {header:"사번(선택)", field:"empNo", type:"text"},
  {header:"계약구분", field:"contractType", type:"select", options:["정규직 근로계약","연봉계약","수습계약","계약직 근로계약","프리랜서 계약"], def:"정규직 근로계약"},
  {header:"계약시작일", field:"startDate", type:"date", required:true},
  {header:"계약종료일", field:"endDate", type:"date"},
  {header:"연봉(만원)", field:"annualSalary", type:"number"},
  {header:"사이닝보너스(만원)", field:"signingBonus", type:"number"},
  {header:"채용수수료(만원)", field:"recruitingFee", type:"number"},
  {header:"변경사유", field:"changeReason", type:"select", options:["신규","연봉인상","연장","재계약","조정"], def:"신규"},
  {header:"서명일", field:"signedDate", type:"date"},
  {header:"상태", field:"status", type:"select", options:["대기","지연","완료"], def:"대기"},
];
export function parseDateCell(val){
  if(val===undefined || val===null || val==="") return "";
  if(typeof val==="number" && window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code){
    const d = XLSX.SSF.parse_date_code(val);
    if(d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if(ymd) return `${ymd[1]}-${String(ymd[2]).padStart(2,"0")}-${String(ymd[3]).padStart(2,"0")}`;
  // M/D/YY or M/D/YYYY (month-first, year last) -- e.g. a date cell stored as plain text in Excel
  // comes through as "6/30/26" rather than a native date serial, which the pattern above doesn't match.
  const mdy = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2}|\d{4})$/);
  if(mdy){
    const mo = Number(mdy[1]), da = Number(mdy[2]);
    let yr = Number(mdy[3]);
    if(mdy[3].length===2) yr += (yr<=68 ? 2000 : 1900);
    if(mo>=1 && mo<=12 && da>=1 && da<=31) return `${yr}-${String(mo).padStart(2,"0")}-${String(da).padStart(2,"0")}`;
  }
  return s;
}
export function matchOption(val, options, def){
  const s = String(val==null?"":val).trim();
  if(!s) return def!==undefined ? def : "";
  const hit = options.find(o=> o===s || o.toLowerCase()===s.toLowerCase());
  return hit || (def!==undefined ? def : s);
}
export function mapImportRow(row, cols){
  const out = {}; const missing = [];
  cols.forEach(c=>{
    const raw = row[c.header];
    let v;
    if(c.type==="date") v = parseDateCell(raw);
    else if(c.type==="number") v = raw===""||raw==null ? 0 : (Number(String(raw).replace(/,/g,""))||0);
    else if(c.type==="select") v = matchOption(raw, c.options, c.def);
    else v = raw==null ? "" : String(raw).trim();
    if(c.required && !v) missing.push(c.header);
    out[c.field] = v;
  });
  return {data:out, missing};
}
export const SAMPLE_EMP_ROWS = [
  ["홍길동","EMP-1001","D365","선임","일반직","근무","일반근무","정직원","한국","1990-05-12","2023-03-01","2023-03-01","010-1234-5678","hong@example.com",5000,"2023-03-01","대기"],
  ["김영희","EMP-1002","Ai agent","대리","일반직","수습","일반근무","정직원","한국","1995-11-03","2026-08-01","2026-08-01","010-2345-6789","kim@example.com",4200,"","아니오"],
];
export const SAMPLE_CONTRACT_ROWS = [
  ["홍길동","EMP-1001","정규직 근로계약","2023-03-01","2024-03-01",5000,0,0,"신규","2023-03-01","대기"],
];
export const SAMPLE_GUIDE_ROWS = [["필드","허용 값"],
  ["사업부", DIVISION_OPTIONS.join(" / ")],
  ["직급/직책", POSITION_OPTIONS.join(" / ")],
  ["고용형태", EMPLOYMENT_TYPE_OPTIONS.join(" / ")],
  ["재직상태", "수습 / 근무 / 퇴사"],
  ["근무형태", WORK_TYPE_OPTIONS.join(" / ")],
  ["채용타입", RECRUIT_TYPE_OPTIONS.join(" / ")],
  ["소속위치", LOCATION_OPTIONS.join(" / ")],
  ["지원금대상자", "아니오 / 대기 / 진행중 / 완료"],
  ["날짜 형식", "YYYY-MM-DD (예: 2026-09-10)"],
  ["계약구분", "정규직 근로계약 / 연봉계약 / 수습계약 / 계약직 근로계약 / 프리랜서 계약"],
  ["계약 변경사유", "신규 / 연봉인상 / 연장 / 재계약 / 조정"],
  ["계약 상태", "활성 / 완료"],
  ["안내", "'계약' 시트의 직원이름은 '직원' 시트(또는 기존 등록된 인력 마스터)의 이름과 일치해야 합니다. 노란색 셀은 드롭다운 목록에서 값을 선택할 수 있습니다."],
];
export function buildSampleWorkbookPlain(){
  const empAoa = [EMP_IMPORT_COLS.map(c=>c.header), ...SAMPLE_EMP_ROWS];
  const contractAoa = [CONTRACT_IMPORT_COLS.map(c=>c.header), ...SAMPLE_CONTRACT_ROWS];
  const guideAoa = SAMPLE_GUIDE_ROWS;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empAoa), "직원");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(contractAoa), "계약");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guideAoa), "안내");
  return wb;
}
export function colLetter(n){
  let s = "";
  while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); }
  return s;
}
export function fillSheetWithValidation(sheet, cols, sampleRows, validationLastRow){
  sheet.addRow(cols.map(c=>c.header));
  sheet.getRow(1).font = {bold:true};
  sampleRows.forEach(r=> sheet.addRow(r));
  cols.forEach((c,idx)=>{
    const colNum = idx+1;
    sheet.getColumn(colNum).width = Math.max(12, c.header.length*1.8);
    if(c.type==="select" && Array.isArray(c.options) && c.options.length){
      const letter = colLetter(colNum);
      for(let row=2; row<=validationLastRow; row++){
        sheet.getCell(`${letter}${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${c.options.join(",")}"`],
          showErrorMessage: true,
          errorStyle: "warning",
          error: "목록에 있는 값 중 하나를 선택해 주세요.",
        };
      }
    }
  });
}
export async function buildSampleWorkbookXlsx(){
  const wb = new ExcelJS.Workbook();
  const empSheet = wb.addWorksheet("직원");
  fillSheetWithValidation(empSheet, EMP_IMPORT_COLS, SAMPLE_EMP_ROWS, 200);
  const contractSheet = wb.addWorksheet("계약");
  fillSheetWithValidation(contractSheet, CONTRACT_IMPORT_COLS, SAMPLE_CONTRACT_ROWS, 200);
  const guideSheet = wb.addWorksheet("안내");
  SAMPLE_GUIDE_ROWS.forEach((r,i)=>{ const row = guideSheet.addRow(r); if(i===0) row.font = {bold:true}; });
  guideSheet.getColumn(1).width = 16;
  guideSheet.getColumn(2).width = 70;
  return wb;
}
export async function exportRowsToExcel(filename, sheetName, cols, rows){
  if(typeof XLSX==="undefined"){ toast("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
  if(!rows.length){ toast("다운로드할 데이터가 없습니다."); return; }
  const aoa = [cols.map(c=>c.header), ...rows.map(r=> cols.map(c=> r[c.field]==null ? "" : r[c.field]))];
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  cols.forEach((c,idx)=>{ if(!sheet["!cols"]) sheet["!cols"]=[]; sheet["!cols"][idx] = {wch: Math.max(12, c.header.length*1.8)}; });
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  const arrbuf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
  const blob = new Blob([arrbuf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  try{
    await saveBlob(filename, blob);
    toast("엑셀 파일을 내려받았습니다.");
  }catch(err){
    toast("파일 저장에 실패했습니다.");
  }
}
export async function exportEmployeesExcel(){
  const rows = filteredEmployeesForMaster();
  await exportRowsToExcel(`인력_마스터_${todayISO().replaceAll("-","")}.xlsx`, "직원", EMP_IMPORT_COLS, rows);
}
export async function downloadSampleExcel(){
  let blob;
  if(typeof ExcelJS!=="undefined"){
    try{
      const wb = await buildSampleWorkbookXlsx();
      const arrbuf = await wb.xlsx.writeBuffer();
      blob = new Blob([arrbuf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    }catch(err){
      blob = null;
    }
  }
  if(!blob){
    if(typeof XLSX==="undefined"){ toast("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
    const wb = buildSampleWorkbookPlain();
    const arrbuf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    blob = new Blob([arrbuf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    toast("드롭다운 선택 기능 없이 샘플 파일을 생성합니다.");
  }
  try{
    await saveBlob("인력_계약_업로드_샘플.xlsx", blob);
    toast("샘플 엑셀 파일을 내려받았습니다.");
  }catch(err){
    toast("샘플 파일 저장에 실패했습니다.");
  }
}
export let importParsed = null; // {employees:[...], contracts:[...], empErrors:[...], contractErrors:[...]}
export function renderImportPreview(){
  const box = byId("importPreviewBox");
  if(!box) return;
  if(!importParsed){ box.innerHTML = ""; return; }
  const {employees, contracts, empErrors, contractErrors} = importParsed;
  const errLines = [...empErrors, ...contractErrors].slice(0,10);
  box.innerHTML = `
    <div class="stat-mini-grid" style="grid-template-columns:repeat(2,1fr); margin-top:14px;">
      <div class="stat-mini"><div class="v">${employees.length}</div><div class="l">직원 · 업로드 가능</div></div>
      <div class="stat-mini"><div class="v">${contracts.length}</div><div class="l">계약 · 업로드 가능</div></div>
    </div>
    ${errLines.length ? `<div class="field hint" style="margin-top:10px; color:var(--danger);">${errLines.map(e=>esc(e)).join("<br>")}${(empErrors.length+contractErrors.length)>10?`<br>외 ${(empErrors.length+contractErrors.length)-10}건`:""}</div>` : ""}
  `;
  const uploadBtn = byId("confirmImportBtn");
  if(uploadBtn) uploadBtn.disabled = (employees.length + contracts.length)===0;
}
export async function handleImportFile(file){
  if(typeof XLSX==="undefined"){ toast("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:"array"});
    const empSheetName = wb.SheetNames.find(n=>n.trim()==="직원") || wb.SheetNames[0];
    const contractSheetName = wb.SheetNames.find(n=>n.trim()==="계약");
    const sheetOpts = {defval:"", raw:false, dateNF:"yyyy-mm-dd"};
    const empRowsRaw = empSheetName ? XLSX.utils.sheet_to_json(wb.Sheets[empSheetName], sheetOpts) : [];
    const contractRowsRaw = contractSheetName ? XLSX.utils.sheet_to_json(wb.Sheets[contractSheetName], sheetOpts) : [];

    const employees = []; const empErrors = [];
    empRowsRaw.forEach((row,i)=>{
      const {data, missing} = mapImportRow(row, EMP_IMPORT_COLS);
      if(missing.length){ empErrors.push(`직원 시트 ${i+2}행: ${missing.join(", ")} 누락으로 건너뜀`); return; }
      employees.push(data);
    });

    const existingNames = new Set(state.employees.map(e=>e.name));
    const importNames = new Set(employees.map(e=>e.name));
    const contracts = []; const contractErrors = [];
    contractRowsRaw.forEach((row,i)=>{
      const {data, missing} = mapImportRow(row, CONTRACT_IMPORT_COLS);
      if(missing.length){ contractErrors.push(`계약 시트 ${i+2}행: ${missing.join(", ")} 누락으로 건너뜀`); return; }
      if(!existingNames.has(data.employeeName) && !importNames.has(data.employeeName)){
        contractErrors.push(`계약 시트 ${i+2}행: '${data.employeeName}' 직원을 찾을 수 없어 건너뜀`);
        return;
      }
      contracts.push(data);
    });

    importParsed = {employees, contracts, empErrors, contractErrors};
    renderImportPreview();
  }catch(err){
    toast("엑셀 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해 주세요.");
  }
}
export async function runImport(){
  if(!importParsed) return;
  const {employees, contracts} = importParsed;
  const nameToId = new Map(state.employees.map(e=>[e.name, e.id]));
  for(const data of employees){
    const payload = {...data, resume:{education:[], careerHistory:[], certifications:[], skills:[]}, currentTasks:[], probation:{}};
    const id = await dbAdd("employees", payload);
    nameToId.set(data.name, id);
  }
  let contractOk = 0;
  for(const data of contracts){
    const employeeId = nameToId.get(data.employeeName);
    if(!employeeId) continue;
    const {employeeName, empNo, ...rest} = data;
    await dbAdd("contracts", {employeeId, employeeName, ...rest});
    contractOk++;
  }
  closeOverlay();
  toast(`직원 ${employees.length}건, 계약 ${contractOk}건이 업로드되었습니다.`);
  importParsed = null;
  setRoute("employees");
}
export function openImportModal(){
  importParsed = null;
  openModal("엑셀로 인력 · 계약 업로드", `
    <div class="field hint" style="margin-bottom:12px;">'직원' 시트와 '계약' 시트로 구성된 엑셀 파일을 업로드해 주세요. 먼저 샘플 파일을 내려받아 형식을 확인하시는 것을 권장합니다.</div>
    <button class="btn btn-sm" id="downloadSampleBtn" type="button">${ICON.download}샘플 엑셀 다운로드</button>
    <div class="divider"></div>
    <div class="field"><label>엑셀 파일 선택 (.xlsx)</label><input type="file" id="importFileInput" accept=".xlsx"></div>
    <div id="importPreviewBox"></div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn btn-primary" id="confirmImportBtn" disabled>업로드</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("downloadSampleBtn").onclick = downloadSampleExcel;
  byId("importFileInput").onchange = (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if(file) handleImportFile(file);
  };
  byId("confirmImportBtn").onclick = runImport;
}
