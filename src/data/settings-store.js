/* =========================================================
   SYSTEM SETTINGS STORE
   -----------------------------------------------------------
   로그인 암호 · 역할별 노출 사업부 · 알림 기준일을 어댑터의
   단일 설정 문서(schema.js 의 SETTINGS_DOC)에 저장한다.
   ========================================================= */

import { settings, DEFAULT_SYSTEM_PASSWORD, DEFAULT_ALERT_DAYS } from "../state/settings.js";
import { adapter, applyDivisionScope } from "./store.js";
import { toast } from "../ui/overlay.js";
import { requestRender } from "../core/bus.js";
import { renderAuthGate } from "../views/auth.js";

/** 저장소에서 설정을 읽어 settings 객체에 반영한다. 앱 시작 시 한 번 호출. */
export async function loadSystemSettings(){
  let d = null;
  try{
    d = adapter ? await adapter.readSettings() : null;
  }catch(err){
    d = null;
  }
  if(d){
    const legacy = d.password; // backward-compat: single shared password from before admin/pmo were split
    settings.passwords.admin = d.adminPassword || legacy || DEFAULT_SYSTEM_PASSWORD;
    settings.passwords.pmo = d.pmoPassword || legacy || DEFAULT_SYSTEM_PASSWORD;
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

async function writeAppSettingsDoc(){
  try{
    await adapter.writeSettings({
      adminPassword: settings.passwords.admin,
      pmoPassword: settings.passwords.pmo,
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
  settings.passwords[role] = newPw;
  const ok = await writeAppSettingsDoc();
  if(!ok) return;
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
