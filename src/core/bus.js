/* =========================================================
   RENDER BUS
   -----------------------------------------------------------
   데이터 계층(store)이 화면 계층(router)을 직접 import 하면
   순환 참조가 된다. 그래서 "다시 그려 달라"는 요청만 이 얇은
   중개자를 거친다. 실제 구현은 app.js 가 등록한다.
   ========================================================= */

let renderFn = null;

/** app.js 에서 실제 렌더 함수를 등록한다. */
export function setRenderer(fn) {
  renderFn = fn;
}

/** 데이터가 바뀌었으니 현재 화면을 다시 그려 달라. */
export function requestRender() {
  if (renderFn) renderFn();
}
