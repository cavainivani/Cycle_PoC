/* =========================================================
   FILE DOWNLOAD
   -----------------------------------------------------------
   원본 초안은 Claude Artifact 런타임의 downloads 기능에 의존했는데,
   일반 웹 서버(Azure App Service)에는 그런 것이 없다. 표준 브라우저
   다운로드로 대체한다.
   ========================================================= */

/**
 * Blob 을 파일로 내려받는다.
 * @param {string} filename 저장될 파일명
 * @param {Blob} blob 내용
 */
export async function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari 가 클릭을 처리할 시간을 준 뒤 해제한다.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
