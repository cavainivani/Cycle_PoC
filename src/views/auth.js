import { byId, esc } from "../core/format.js";
import { renderNav, renderRoute } from "../core/router.js";
import { applyDivisionScope } from "../data/store.js";
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
        <input type="password" id="loginPassword" placeholder="암호를 입력하세요" ${settings.ready?"":"disabled"}>
      </div>
      ${ui.loginError?`<div class="login-error">${esc(ui.loginError)}</div>`:""}
      <button class="btn btn-primary" id="loginSubmitBtn" style="width:100%; margin-top:16px; justify-content:center;" ${settings.ready?"":"disabled"}>${settings.ready?"로그인":"불러오는 중..."}</button>
    </div>
  `;
  root.querySelectorAll("[data-role]").forEach(b=> b.onclick = ()=>{ ui.loginRole = b.dataset.role; renderAuthGate(); });
  const pwInput = byId("loginPassword");
  const submit = ()=>{
    if(!settings.ready) return;
    const val = pwInput ? pwInput.value : "";
    if(val && val===settings.passwords[ui.loginRole]){
      Object.assign(authState, { loggedIn:true, role:ui.loginRole });
      ui.loginError = "";
      applyDivisionScope();
      renderAuthGate();
      renderNav(); renderRoute();
    } else {
      ui.loginError = "암호가 올바르지 않습니다.";
      renderAuthGate();
    }
  };
  const submitBtn = byId("loginSubmitBtn");
  if(submitBtn) submitBtn.onclick = submit;
  if(pwInput){
    pwInput.focus();
    pwInput.onkeydown = (ev)=>{ if(ev.key==="Enter") submit(); };
  }
}
export function logout(){
  Object.assign(authState, { loggedIn:false, role:null });
  ui.loginError = "";
  applyDivisionScope();
  renderAuthGate();
}
