import { byId, esc } from "../core/format.js";
import { renderNav, renderRoute } from "../core/router.js";
import { adapter, applyDivisionScope, clearLoadedData, reloadAll } from "../data/store.js";
import { loadSystemSettings } from "../data/settings-store.js";
import { authState, settings } from "../state/settings.js";
import { ui } from "../state/ui.js";
export function renderAuthGate(){
  const root = byId("authRoot");
  const shell = document.querySelector(".app-shell");
  if(!root) return;
  if(authState.loggedIn){
    root.style.display = "none";
    root.innerHTML = "";
    if(shell) shell.style.display = "";
    return;
  }
  if(shell) shell.style.display = "none";
  root.style.display = "flex";
  root.innerHTML = `
    <div class="login-card">
      <div class="login-brand">
        <div class="mark">TL</div>
        <div>
          <div class="name">인재 라이프사이클 허브</div>
          <div class="sub">M. Cloud Bridge HR Ops</div>
        </div>
      </div>
      <div class="field" style="margin-top:18px;">
        <label>사용자</label>
        <div class="segmented" id="loginRoleSeg">
          <button type="button" data-role="admin" class="${ui.loginRole==="admin"?"active":""}">관리자 (admin)</button>
          <button type="button" data-role="pmo" class="${ui.loginRole==="pmo"?"active":""}">PMO</button>
        </div>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>시스템 암호</label>
        <input type="password" id="loginPassword" placeholder="암호를 입력하세요" ${settings.ready&&!ui.loginBusy?"":"disabled"}>
      </div>
      ${ui.loginError?`<div class="login-error">${esc(ui.loginError)}</div>`:""}
      <button class="btn btn-primary" id="loginSubmitBtn" style="width:100%; margin-top:16px; justify-content:center;" ${settings.ready&&!ui.loginBusy?"":"disabled"}>${!settings.ready?"불러오는 중...":(ui.loginBusy?"확인 중...":"로그인")}</button>
    </div>
  `;
  root.querySelectorAll("[data-role]").forEach(b=> b.onclick = ()=>{ ui.loginRole = b.dataset.role; renderAuthGate(); });
  const pwInput = byId("loginPassword");
  // 암호 검사는 어댑터가 한다. rest 모드에서는 서버가 검사하고 세션 쿠키를
  // 내려주므로, 브라우저는 암호 정답을 알지 못한다.
  const submit = async ()=>{
    if(!settings.ready || ui.loginBusy) return;
    const val = pwInput ? pwInput.value : "";
    if(!val){
      ui.loginError = "암호를 입력해 주세요.";
      renderAuthGate();
      return;
    }
    ui.loginBusy = true; ui.loginError = "";
    renderAuthGate();
    let role = null;
    try{
      role = await adapter.login(ui.loginRole, val);
    }catch(err){
      ui.loginBusy = false;
      ui.loginError = "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      renderAuthGate();
      return;
    }
    ui.loginBusy = false;
    if(!role){
      ui.loginError = "암호가 올바르지 않습니다.";
      renderAuthGate();
      return;
    }
    await onLoggedIn(role);
  };
  const submitBtn = byId("loginSubmitBtn");
  if(submitBtn) submitBtn.onclick = submit;
  if(pwInput){
    pwInput.focus();
    pwInput.onkeydown = (ev)=>{ if(ev.key==="Enter") submit(); };
  }
}

/**
 * 로그인 직후 처리.
 * rest 모드에서는 로그인 전 요청이 전부 401 이었으므로, 여기서 설정과
 * 데이터를 처음으로 실제 조회한다.
 */
export async function onLoggedIn(role){
  Object.assign(authState, { loggedIn:true, role });
  ui.loginError = "";
  await loadSystemSettings();
  await reloadAll();
  applyDivisionScope();
  renderAuthGate();
  renderNav(); renderRoute();
}

export async function logout(){
  try{
    if(adapter && typeof adapter.logout === "function") await adapter.logout();
  }catch(err){ /* 세션 정리는 실패해도 화면은 로그아웃시킨다 */ }
  Object.assign(authState, { loggedIn:false, role:null });
  ui.loginError = "";
  // 로그아웃 후에도 메모리에 데이터가 남아 있지 않게 비운다.
  clearLoadedData();
  applyDivisionScope();
  renderAuthGate();
}

/** 세션이 끊겼을 때(401) 로그인 화면으로 되돌린다. */
export function forceLogout(message){
  Object.assign(authState, { loggedIn:false, role:null });
  ui.loginError = message || "세션이 만료되었습니다. 다시 로그인해 주세요.";
  clearLoadedData();
  applyDivisionScope();
  renderAuthGate();
}
