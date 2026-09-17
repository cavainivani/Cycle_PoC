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
import { adapter, initStore, setUnauthorizedHandler } from "./data/store.js";
import { renderAuthGate, logout, onLoggedIn, forceLogout } from "./views/auth.js";
import { settings } from "./state/settings.js";
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

  // 어댑터만 준비한다. 데이터 조회는 로그인 이후다 — rest 모드에서는
  // 로그인 전 /api 요청이 전부 401 이기 때문이다.
  await initStore();
  setUnauthorizedHandler(()=> forceLogout());

  // 어댑터가 준비되면 로그인 버튼을 열어 준다.
  settings.ready = true;
  renderAuthGate();

  // 이미 유효한 세션이 있으면(쿠키가 살아 있으면) 바로 들어간다.
  let role = null;
  try{
    role = adapter && typeof adapter.session === "function" ? await adapter.session() : null;
  }catch(err){ role = null; }

  if(role) await onLoggedIn(role);
  else { renderNav(); renderRoute(); }
}

init();
