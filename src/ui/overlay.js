import { byId, esc } from "../core/format.js";
import { ICON } from "./icons.js";
export function toast(msg){
  const wrap = byId("toastWrap");
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
}
export const confirmState = { resolve:true };
export function confirmDialog(title, body){
  return new Promise(resolve=>{
    openOverlay(`
      <div class="modal">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="close-x" data-close>${ICON.x}</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn" data-cancel>취소</button>
          <button class="btn btn-primary" style="background:var(--danger);border-color:var(--danger)" data-ok>삭제</button>
        </div>
      </div>`, true);
    const root = byId("overlayRoot");
    root.querySelector("[data-ok]").onclick = ()=>{ closeOverlay(); resolve(true); };
    root.querySelector("[data-cancel]").onclick = ()=>{ closeOverlay(); resolve(false); };
    root.querySelector("[data-close]").onclick = ()=>{ closeOverlay(); resolve(false); };
  });
}
export function openOverlay(html, center){
  const root = byId("overlayRoot");
  root.innerHTML = `<div class="overlay ${center?"center":""}" id="ovBg">${html}</div>`;
  root.querySelector("#ovBg").addEventListener("mousedown", (e)=>{ if(e.target.id==="ovBg") closeOverlay(); });
}
export function closeOverlay(){ byId("overlayRoot").innerHTML = ""; }
export function openModal(title, bodyHtml, footHtml){
  openOverlay(`
    <div class="modal">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="close-x" data-close>${ICON.x}</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml?`<div class="modal-foot">${footHtml}</div>`:""}
    </div>`, true);
  byId("overlayRoot").querySelector("[data-close]").onclick = closeOverlay;
}
