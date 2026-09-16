import { LOCATION_OPTIONS, RECRUIT_TYPE_OPTIONS } from "../config/options.js";
import { saveBlob } from "../core/download.js";
import { byId, daysUntil, ddayLabel, esc, fmtDate, fmtWon, todayISO } from "../core/format.js";
import { state } from "../data/store.js";
import { contractRenewalDueList, probationStatusOf } from "../domain/hr.js";
import { authState } from "../state/settings.js";
import { ICON } from "../ui/icons.js";
import { closeOverlay, openModal, toast } from "../ui/overlay.js";
import { probationEvalTargets } from "./probation.js";
export function hrReportData(){
  const all = state.employees;
  const active = all.filter(e=>e.status!=="퇴사");
  const probationers = all.filter(e=> e.status==="수습");
  const subsidyYes = all.filter(e=> e.subsidyEligible && e.subsidyEligible!=="아니오");
  const maternityCount = active.filter(e=>e.workType==="출산휴가").length;
  const childcareCount = active.filter(e=>e.workType==="육아단축근무").length;
  const expiringContracts = state.contracts.filter(c=>{ const d=daysUntil(c.endDate); return c.status!=="완료" && d!==null && d>=0 && d<=30; }).sort((a,b)=>daysUntil(a.endDate)-daysUntil(b.endDate));

  const deptCounts = {};
  active.forEach(e=>{ const d=e.division||"미지정"; deptCounts[d]=(deptCounts[d]||0)+1; });
  const deptRows = Object.entries(deptCounts).sort((a,b)=>b[1]-a[1]);

  const recruitTypeCounts = {};
  RECRUIT_TYPE_OPTIONS.forEach(o=>recruitTypeCounts[o]=0);
  active.forEach(e=>{ const r=e.recruitType||"정직원"; recruitTypeCounts[r]=(recruitTypeCounts[r]||0)+1; });

  const locationCounts = {};
  LOCATION_OPTIONS.forEach(o=>locationCounts[o]=0);
  active.forEach(e=>{ const l=e.location||"한국"; locationCounts[l]=(locationCounts[l]||0)+1; });

  const upcomingProbation = [...probationers].sort((a,b)=>{
    const da = (a.probation && a.probation.endDate) ? daysUntil(a.probation.endDate) : Infinity;
    const db = (b.probation && b.probation.endDate) ? daysUntil(b.probation.endDate) : Infinity;
    return da - db;
  });

  const probationTargetCount = probationEvalTargets().length;
  const contractTargetCount = contractRenewalDueList().length;
  const subsidyPendingCount = state.subsidyApps.filter(a=>(a.status||"대기")==="대기").length;
  const subsidyYearReceived = (()=>{ const y=String(new Date().getFullYear()); let sum=0; state.subsidyApps.forEach(a=>(a.months||[]).forEach(m=>{ if(m.ym&&m.ym.startsWith(y+"-")&&m.submitted) sum+=Number(m.amount)||0; })); return sum; })();

  return { all, active, probationers, subsidyYes, maternityCount, childcareCount, expiringContracts, deptRows, recruitTypeCounts, locationCounts, upcomingProbation, probationTargetCount, contractTargetCount, subsidyPendingCount, subsidyYearReceived };
}
export function renderHrReport(){
  const d = hrReportData();
  return `
    <div class="topbar no-print">
      <div><h1>인력 현황 보고서</h1><div class="desc">현재 대시보드 화면과 동일한 내용의 인력 현황 보고서입니다. 보기·PDF 저장·이메일 발송이 가능합니다.</div></div>
      <div class="topbar-actions">
        <button class="btn" data-route-to="dashboard">${ICON.chevron}대시보드로</button>
        <button class="btn" id="btnEmailReport">${ICON.doc}이메일로 보내기</button>
        <button class="btn btn-primary" id="btnPrintReport">${ICON.doc}PDF로 저장 / 인쇄</button>
      </div>
    </div>

    ${buildReportPageHtml(d)}
  `;
}
export function buildReportPageHtml(d){
  const { all, active, probationers, subsidyYes, maternityCount, childcareCount, expiringContracts, deptRows, recruitTypeCounts, locationCounts, upcomingProbation, probationTargetCount, contractTargetCount, subsidyPendingCount, subsidyYearReceived } = d;
  const todayLabel = esc(todayISO()).replaceAll("-",".");

  return `
    <div class="report-page">
      <div class="report-head">
        <div class="report-brand">M. Cloud Bridge · 인재 라이프사이클 허브</div>
        <h1>인력 현황 보고서 - ${esc(authState.role||"—")}</h1>
        <div class="report-meta">기준일: ${todayLabel}　·　전체 등록 인원: ${all.length}명</div>
      </div>

      <div class="report-section">
        <h2>1. 대시보드 요약</h2>
        <div class="report-stat-grid">
          <div class="report-stat"><div class="v">${active.length}</div><div class="l">재직 인원</div></div>
          <div class="report-stat"><div class="v">${contractTargetCount}</div><div class="l">계약 관리 대상 직원</div></div>
          <div class="report-stat"><div class="v">${subsidyYes.length}</div><div class="l">정부지원금 대상</div></div>
          <div class="report-stat"><div class="v">${maternityCount+childcareCount}</div><div class="l">출산·육아 휴가</div></div>
          <div class="report-stat"><div class="v">${probationTargetCount}</div><div class="l">수습 평가 대상자</div></div>
          <div class="report-stat"><div class="v">${subsidyPendingCount}</div><div class="l">지원금 신청 대기</div></div>
          <div class="report-stat"><div class="v">${fmtWon(subsidyYearReceived)}</div><div class="l">${new Date().getFullYear()}년 지원금 수금액</div></div>
        </div>
      </div>

      <div class="report-section">
        <h2>2. 직원 계약 정보</h2>
        <div class="report-subhead">사업부별 재직 인원 (합계 ${active.length}명)</div>
        ${deptRows.length ? `<table class="report-table"><thead><tr><th>사업부</th><th class="num">인원</th></tr></thead><tbody>
          ${deptRows.map(([dd,c])=>`<tr><td>${esc(dd)}</td><td class="num">${c}명</td></tr>`).join("")}
        </tbody></table>` : `<div class="report-empty">등록된 재직 인원이 없습니다</div>`}
        <div class="report-subhead">채용 타입별 인원</div>
        <table class="report-table"><thead><tr><th>채용 타입</th><th class="num">인원</th></tr></thead><tbody>
          ${RECRUIT_TYPE_OPTIONS.map(o=>`<tr><td>${esc(o)}</td><td class="num">${recruitTypeCounts[o]}명</td></tr>`).join("")}
        </tbody></table>
        <div class="report-subhead">소속 위치별 인원</div>
        <table class="report-table"><thead><tr><th>위치</th><th class="num">인원</th></tr></thead><tbody>
          ${LOCATION_OPTIONS.map(o=>`<tr><td>${esc(o)}</td><td class="num">${locationCounts[o]}명</td></tr>`).join("")}
        </tbody></table>
        <div class="report-subhead">계약 만료 예정 (${expiringContracts.length}건)</div>
        ${expiringContracts.length ? `<table class="report-table"><thead><tr><th>직원</th><th>계약구분</th><th>종료일</th><th>D-day</th></tr></thead><tbody>
          ${expiringContracts.map(c=>`<tr><td>${esc(c.employeeName)}</td><td>${esc(c.contractType||"—")}</td><td>${fmtDate(c.endDate)}</td><td class="num">${ddayLabel(c.endDate)}</td></tr>`).join("")}
        </tbody></table>` : `<div class="report-empty">30일 이내 만료되는 계약이 없습니다</div>`}
      </div>

      <div class="report-section">
        <h2>3. 인력 평가 정보</h2>
        <div class="report-subhead">수습 만료 예정 (${upcomingProbation.length}명)</div>
        ${upcomingProbation.length ? `<table class="report-table"><thead><tr><th>이름</th><th>사업부</th><th>상태</th><th>수습 종료일</th></tr></thead><tbody>
          ${upcomingProbation.map(e=>{ const st=probationStatusOf(e); const hasEnd = e.probation && e.probation.endDate;
            return `<tr><td>${esc(e.name)}</td><td>${esc(e.division||"—")}</td><td>${esc(st.label)}</td><td>${hasEnd?`${fmtDate(e.probation.endDate)} (${ddayLabel(e.probation.endDate)})`:"미등록"}</td></tr>`; }).join("")}
        </tbody></table>` : `<div class="report-empty">수습 인력이 없습니다</div>`}
      </div>

      <div class="report-foot">본 보고서는 인재 라이프사이클 허브 시스템에 등록된 데이터를 기준으로 ${todayLabel}에 생성되었습니다.${all.some(e=>e.isSample)?" (샘플 데이터가 포함되어 있습니다)":""}</div>
    </div>
  `;
}
export function buildReportEmailText(){
  const d = hrReportData();
  const todayLabel = todayISO().replaceAll("-",".");
  const lines = [];
  lines.push("[인력 현황 보고서] 기준일: "+todayLabel);
  lines.push("");
  lines.push("■ 대시보드 요약");
  lines.push(`재직 인원 ${d.active.length}명 / 계약 관리 대상 직원 ${d.contractTargetCount}명 / 정부지원금 대상 ${d.subsidyYes.length}명 / 출산·육아휴가 ${d.maternityCount+d.childcareCount}명`);
  lines.push(`수습 평가 대상자 ${d.probationTargetCount}명 / 지원금 신청 대기 ${d.subsidyPendingCount}건 / ${new Date().getFullYear()}년 지원금 수금액 ${fmtWon(d.subsidyYearReceived)}`);
  lines.push("");
  lines.push("■ 직원 계약 정보");
  lines.push("사업부별 재직 인원:");
  d.deptRows.forEach(([dd,c])=> lines.push(`- ${dd}: ${c}명`));
  if(d.expiringContracts.length){
    lines.push("");
    lines.push("계약 만료 예정 ("+d.expiringContracts.length+"건):");
    d.expiringContracts.slice(0,15).forEach(c=> lines.push(`- ${c.employeeName} · ${c.contractType||"—"} · 종료일 ${fmtDate(c.endDate)} (${ddayLabel(c.endDate)})`));
    if(d.expiringContracts.length>15) lines.push(`  … 외 ${d.expiringContracts.length-15}건은 전체 보고서를 확인해 주세요.`);
  }
  lines.push("");
  if(d.upcomingProbation.length){
    lines.push("■ 인력 평가 정보");
    lines.push("수습 만료 예정 ("+d.upcomingProbation.length+"명):");
    d.upcomingProbation.slice(0,15).forEach(e=>{
      const st = probationStatusOf(e);
      const hasEnd = e.probation && e.probation.endDate;
      lines.push(`- ${e.name} (${e.division||"—"}) · ${st.label} · 종료일 ${hasEnd?fmtDate(e.probation.endDate):"미등록"}`);
    });
    if(d.upcomingProbation.length>15) lines.push(`  … 외 ${d.upcomingProbation.length-15}명은 전체 보고서를 확인해 주세요.`);
    lines.push("");
  }
  lines.push("본 메일은 인재 라이프사이클 허브 시스템의 대시보드 화면 기준으로 자동 생성되었습니다.");
  return lines.join("\n");
}
export async function buildReportPdfBlob(){
  if(typeof html2canvas==="undefined" || !(window.jspdf && window.jspdf.jsPDF)) return null;
  const d = hrReportData();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed; left:-10000px; top:0; width:794px; background:#ffffff; z-index:-1;";
  host.setAttribute("data-theme","light");
  host.style.setProperty("--surface","#ffffff");
  host.style.setProperty("--surface-2","#eef0f9");
  host.style.setProperty("--border","#dde1f0");
  host.style.setProperty("--text","#1a1d2e");
  host.style.setProperty("--text-muted","#5b607a");
  host.style.setProperty("--text-faint","#8589a8");
  host.style.setProperty("--radius","12px");
  host.innerHTML = buildReportPageHtml(d);
  document.body.appendChild(host);
  try{
    const canvas = await html2canvas(host, {scale:2, backgroundColor:"#ffffff", useCORS:true});
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({unit:"pt", format:"a4"});
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = canvas.height * (imgW / canvas.width);
    const imgData = canvas.toDataURL("image/png");
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while(heightLeft > 0){
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output("blob");
  }catch(err){
    return null;
  }finally{
    document.body.removeChild(host);
  }
}
export async function downloadReportPdf(btn){
  const origLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "PDF 생성 중…";
  try{
    const blob = await buildReportPdfBlob();
    if(!blob){ toast("PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."); return; }
    await saveBlob(`인력_현황_보고서_${todayISO().replaceAll("-","")}.pdf`, blob);
    toast("PDF 파일을 내려받았습니다. 메일에 직접 첨부해 주세요.");
  }catch(err){
    toast("PDF 저장에 실패했습니다.");
  }finally{
    btn.disabled = false; btn.textContent = origLabel;
  }
}
export function openEmailReportModal(){
  const subject = "[인재 라이프사이클 허브] 인력 현황 보고서 "+todayISO().replaceAll("-",".");
  const body = buildReportEmailText();
  openModal("이메일로 보내기", `
    <div class="hint" style="margin-bottom:12px;">받는사람을 입력하고 "메일 앱 열기"를 누르면, 이 컴퓨터의 기본 이메일 프로그램(Outlook·Gmail 등)이 아래 제목·본문이 채워진 상태로 열립니다. 이 화면 자체가 메일을 대신 발송하지는 않으며, 열린 메일 프로그램에서 직접 보내기를 눌러야 실제로 전송됩니다.</div>
    <div class="hint" style="margin-bottom:12px;">메일 발송(mailto) 방식은 파일을 자동으로 첨부할 수 없습니다. 요약 내용과 별도로 보고서를 PDF 파일로 첨부하려면 아래 "PDF 첨부파일 다운로드"를 눌러 PDF를 저장한 뒤, 열린 메일 프로그램에서 직접 첨부해 주세요.</div>
    <div class="form-grid single">
      <div class="field"><label>받는사람 (이메일, 콤마로 구분 가능)</label><input type="text" id="er_to" placeholder="name@company.com"></div>
      <div class="field"><label>제목</label><input type="text" id="er_subject" value="${esc(subject)}"></div>
      <div class="field"><label>본문 (필요시 수정 가능)</label><textarea id="er_body" rows="12">${esc(body)}</textarea></div>
    </div>
  `, `<button class="btn" data-cancel>취소</button><button class="btn" id="er_pdf">${ICON.doc}PDF 첨부파일 다운로드</button><button class="btn btn-primary" id="er_send">메일 앱 열기</button>`);
  byId("overlayRoot").querySelector("[data-cancel]").onclick = closeOverlay;
  byId("er_pdf").onclick = (ev)=> downloadReportPdf(ev.currentTarget);
  byId("er_send").onclick = ()=>{
    const to = byId("er_to").value.trim();
    if(!to){ toast("받는사람 이메일을 입력해 주세요."); return; }
    const subj = byId("er_subject").value;
    const bod = byId("er_body").value;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bod)}`;
    window.location.href = mailto;
    closeOverlay();
    toast("메일 프로그램을 열었습니다. 내용 확인 후 보내기를 눌러주세요.");
  };
}
