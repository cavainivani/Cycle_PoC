/* =========================================================
   SYSTEM SETTINGS STORE
   -----------------------------------------------------------
   로그인 암호 · 역할별 노출 사업부 · 알림 기준일을 어댑터의
   단일 설정 문서(schema.js 의 SETTINGS_DOC)에 저장한다.
   ========================================================= */

import { settings, DEFAULT_ALERT_DAYS } from "../state/settings.js";
import { adapter, applyDivisionScope } from "./store.js";
import { toast } from "../ui/overlay.js";
import { requestRender } from "../core/bus.js";
import { renderAuthGate } from "../views/auth.js";

/**
 * 저장소에서 설정을 읽어 settings 객체에 반영한다. 로그인 직후 호출된다.
 *
 * ★ 암호는 여기로 오지 않는다.
 *   서버의 GET /api/settings 응답에 암호가 들어 있지 않고, 들어 있어서도
 *   안 된다. 암호 검사는 서버가 하고(adapter.login), 브라우저는 정답을
 *   알 필요가 없다.
 */
export async function loadSystemSettings(){
  let d = null;
  try{
    d = adapter ? await adapter.readSettings() : null;
  }catch(err){
    d = null;
  }
  if(d){
    if(Array.isArray(d.visibleDivisions)){
      // backward-compat: earlier version stored one shared array for both roles
      settings.visibleDivisions = { admin: d.visibleDivisions, pmo: d.visibleDivisions };
    } else if(d.visibleDivisions && typeof d.visibleDivisions==="object"){
      settings.visibleDivisions = {
        admin: Array.isArray(d.visibleDivisions.admin) ? d.visibleDivisions.admin : [],
        pmo: Array.isArray(d.visibleDivisions.pmo) ? d.visibleDivisions.pmo : [],
      };
    } else {
      settings.visibleDivisions = { admin: [], pmo: [] };
    }
    if(d.alertDays && typeof d.alertDays==="object"){
      settings.alertDays = {
        probation: Number(d.alertDays.probation)>0 ? Number(d.alertDays.probation) : DEFAULT_ALERT_DAYS.probation,
        contract: Number(d.alertDays.contract)>0 ? Number(d.alertDays.contract) : DEFAULT_ALERT_DAYS.contract,
      };
    } else {
      settings.alertDays = { probation: DEFAULT_ALERT_DAYS.probation, contract: DEFAULT_ALERT_DAYS.contract };
    }
  }
  settings.ready = true;
  applyDivisionScope();
  renderAuthGate();
  requestRender();
}

// 암호는 이 문서에 넣지 않는다 — 별도 경로(adapter.setPassword)로만 바꾼다.
// 여기에 암호를 실으면, 조회 응답에 암호가 없는 지금 구조에서는 빈 값으로
// 덮여 날아간다.
async function writeAppSettingsDoc(){
  try{
    await adapter.writeSettings({
      visibleDivisions: settings.visibleDivisions,
      alertDays: settings.alertDays,
    });
    return true;
  }catch(err){
    toast("설정 저장에 실패했습니다. 이 화면(탭)에서는 적용되었지만 저장되지 않았을 수 있습니다.");
    return false;
  }
}

export async function setSystemPassword(role, newPw){
  try{
    await adapter.setPassword(role, newPw);
  }catch(err){
    toast("암호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  toast((role==="admin"?"관리자":"PMO")+" 암호가 변경되었습니다.");
}

export async function setVisibleDivisions(role, divs){
  settings.visibleDivisions[role] = divs.slice();
  applyDivisionScope();
  requestRender();
  const ok = await writeAppSettingsDoc();
  if(!ok) return;
  const roleLabel = role==="admin" ? "관리자(admin)" : "PMO";
  toast(settings.visibleDivisions[role].length ? `${roleLabel} 계정에는 선택한 사업부만 보이도록 적용했습니다.` : `${roleLabel} 계정의 사업부 제한을 해제했습니다.`);
}

export async function setAlertDays(probationDays, contractDays){
  const p = Number(probationDays), c = Number(contractDays);
  if(!(p>0) || !(c>0)){ toast("알림 기준일은 1일 이상의 숫자로 입력해 주세요."); return; }
  settings.alertDays = { probation: Math.round(p), contract: Math.round(c) };
  requestRender();
  const ok = await writeAppSettingsDoc();
  if(!ok) return;
  toast(`알림 기준일이 저장되었습니다. (수습 평가 ${settings.alertDays.probation}일 / 계약 갱신 ${settings.alertDays.contract}일)`);
}
