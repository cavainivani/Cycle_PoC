/* =========================================================
   VENDOR LIBRARIES
   -----------------------------------------------------------
   엑셀 읽기/쓰기와 PDF 생성에 쓰이는 외부 라이브러리.

   원본 초안은 이 넷을 CDN <script> 태그로 불러왔는데, 사내망에서
   외부 CDN이 막혀 있으면 엑셀·PDF 기능만 조용히 실패한다. 그래서
   npm 의존성으로 가져와 번들에 포함시킨다.

   기존 코드가 전역 이름(XLSX, ExcelJS ...)을 그대로 쓰고 있으므로
   여기서 window 에 얹어 주고, 용량이 큰 만큼 첫 화면을 막지 않도록
   동적 import 로 뒤늦게 로드한다. 로드 전에 기능을 누르면 각
   호출부의 `typeof XLSX === "undefined"` 가드가 안내 문구를 띄운다.
   ========================================================= */

export const vendorReady = (async () => {
  const [xlsx, exceljs, html2canvas, jspdf] = await Promise.all([
    import("xlsx"),
    import("exceljs"),
    import("html2canvas"),
    import("jspdf"),
  ]);
  window.XLSX = xlsx.default && xlsx.default.utils ? xlsx.default : xlsx;
  window.ExcelJS = exceljs.default || exceljs;
  window.html2canvas = html2canvas.default || html2canvas;
  window.jspdf = jspdf.default && jspdf.default.jsPDF ? jspdf.default : jspdf;
})().catch((err) => {
  console.error("[vendor] 엑셀/PDF 라이브러리 로드 실패", err);
});
