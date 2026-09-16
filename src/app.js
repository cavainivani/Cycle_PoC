/* =========================================================
   APP BOOTSTRAP
   -----------------------------------------------------------
   기동 순서:
     1) 렌더 버스에 renderRoute 등록 (데이터 계층 -> 화면 갱신 통로)
     2) 저장소(어댑터) 준비 + 전체 데이터 로드
     3) 시스템 설정 로드 -> 로그인 게이트 활성화
     4) 첫 화면 렌더
   ========================================================= */

import "./styles.css";
import "./vendor.js";

import { setRenderer } from "./core/bus.js";
import { byId } from "./core/format.js";
import { renderNav, renderRoute } from "./core/router.js";
import { initStore } from "./data/store.js";
import { loadSystemSettings } from "./data/settings-store.js";
import { renderAuthGate, logout } from "./views/auth.js";
import { ui } from "./state/ui.js";

// 화면 바깥을 클릭하면 열려 있는 필터 드롭다운을 닫는다.
document.addEventListener("click", ()=>{
  if(ui.openFilterDropdown){ ui.openFilterDropdown = null; renderRoute(); }
});

async function init(){
  setRenderer(renderRoute);

  renderAuthGate();
  const logoutBtn = byId("logoutBtn"); if(logoutBtn) logoutBtn.onclick = logout;
  renderNav();
  renderRoute();

  await initStore();
  await loadSystemSettings();

  renderNav();
  renderRoute();
}

init();
