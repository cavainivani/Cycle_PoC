/* =========================================================
   DATA STORE
   -----------------------------------------------------------
   화면과 저장소 사이의 단 하나의 통로. 화면 코드는 여기서
   내보내는 state / dbAdd / dbUpdate / dbDelete 만 쓰고, 실제
   저장이 어디로 가는지는 전혀 모른다.

       화면(views)  ->  store.js  ->  adapter  ->  localStorage | REST API

   어댑터 교체는 .env 의 VITE_DATA_SOURCE 한 줄로 끝난다.
   (local = 기본값, DB 없음 / rest = server/index.js 의 /api 사용)
   ========================================================= */

import { COLLECTION_PATHS, PATH_KEY } from "./schema.js";
import { createLocalAdapter } from "./adapters/local.js";
import { createRestAdapter } from "./adapters/rest.js";
import { settings, authState } from "../state/settings.js";
import { toast } from "../ui/overlay.js";
import { requestRender } from "../core/bus.js";

export { PATH_KEY };

const SOURCE = (import.meta.env && import.meta.env.VITE_DATA_SOURCE) || "local";

/** 현재 활성 어댑터. app.js 의 initStore() 에서 채워진다. */
export let adapter = null;

/**
 * rawState = 저장소에 있는 그대로의 전체 데이터.
 * state    = 현재 로그인한 역할의 "노출 사업부" 범위로 걸러진 뷰.
 * 화면 코드는 항상 state 만 읽는다.
 */
export const rawState = { employees: [], projects: [], projectEvals: [], annualEvals: [], regularEvals: [], contracts: [], subsidyApps: [], subsidyPrograms: [] };
export const state    = { employees: [], projects: [], projectEvals: [], annualEvals: [], regularEvals: [], contracts: [], subsidyApps: [], subsidyPrograms: [] };

/** 저장소 접근에 실패했을 때 상단 배너에 표시할 메시지 (없으면 null) */
export const storeStatus = { error: null, source: SOURCE, origin: null };

// Recomputes `state` as a division-scoped VIEW of `rawState`. When visibleDivisions
// is empty, every screen sees the full data (unrestricted). When it holds one or more
// division names, `state` is filtered down to only those divisions' employees and any
// records tied to those employees -- every existing render function keeps reading
// `state` unchanged, so this is the single choke point for the whole-app scoping.
export function applyDivisionScope(){
  const roleDivs = (authState.role && settings.visibleDivisions[authState.role]) || [];
  const restrict = roleDivs.length > 0;
  const visIds = restrict ? new Set((rawState.employees||[]).filter(e=> roleDivs.includes(e.division||"미지정")).map(e=>e.id)) : null;
  state.employees = restrict ? (rawState.employees||[]).filter(e=> visIds.has(e.id)) : (rawState.employees||[]);
  ["projectEvals","annualEvals","regularEvals","contracts","subsidyApps"].forEach(key=>{
    state[key] = restrict ? (rawState[key]||[]).filter(d=> visIds.has(d.employeeId)) : (rawState[key]||[]);
  });
  state.projects = rawState.projects || [];
  state.subsidyPrograms = rawState.subsidyPrograms || [];
}

export function deepMerge(base, patch){
  const out = {...base};
  for(const k in patch){
    if(patch[k] && typeof patch[k]==="object" && !Array.isArray(patch[k]) && base[k] && typeof base[k]==="object"){
      out[k] = deepMerge(base[k], patch[k]);
    } else out[k] = patch[k];
  }
  return out;
}

/** 어댑터에서 전체 데이터를 다시 읽어 rawState / state 를 갱신한다. */
export async function reloadAll(){
  if(!adapter) return;
  try{
    const dump = await adapter.load();
    COLLECTION_PATHS.forEach(path=>{
      rawState[PATH_KEY[path]] = (dump[path] || []).slice();
    });
    storeStatus.error = null;
  }catch(err){
    storeStatus.error = err && err.message ? err.message : String(err);
  }
  applyDivisionScope();
}

/** 저장소를 준비한다. 앱 시작 시 한 번만 호출. */
export async function initStore(){
  adapter = SOURCE === "rest" ? createRestAdapter() : createLocalAdapter();
  storeStatus.source = adapter.name;
  storeStatus.origin = adapter.origin;
  await reloadAll();
}

function recordById(path, id){
  return (rawState[PATH_KEY[path]] || []).find(d=> d.id===id) || {};
}

async function mutate(fn){
  try{
    const result = await fn();
    await reloadAll();
    requestRender();
    return result;
  }catch(err){
    storeStatus.error = err && err.message ? err.message : String(err);
    toast("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    requestRender();
    return null;
  }
}

export async function dbAdd(path, data){
  return mutate(()=> adapter.add(path, {...data, createdAt:new Date().toISOString()}));
}
export async function dbSet(path, id, data){
  return mutate(()=> adapter.set(path, id, data));
}
export async function dbUpdate(path, id, patch){
  // 어댑터에는 항상 "병합이 끝난 레코드 전체"를 넘긴다 — 중첩 객체(probation, resume 등)를
  // 부분 갱신할 때 어댑터마다 동작이 달라지지 않도록 병합을 여기서 끝낸다.
  return mutate(()=> adapter.update(path, id, deepMerge(recordById(path, id), patch)));
}
export async function dbDelete(path, id){
  return mutate(()=> adapter.remove(path, id));
}

export async function clearSampleData(){
  for(const path of COLLECTION_PATHS){
    const key = PATH_KEY[path];
    const samples = (rawState[key]||[]).filter(d=>d.isSample);
    for(const s of samples){ await adapter.remove(path, s.id); }
  }
  await reloadAll();
  requestRender();
  toast("샘플 데이터를 정리했습니다.");
}

/** 저장된 내용을 전부 버리고 예시 데이터로 되돌린다 (local 어댑터 전용). */
export async function resetToSeed(){
  if(!adapter || typeof adapter.reset !== "function"){
    toast("이 데이터 소스에서는 초기화를 지원하지 않습니다.");
    return;
  }
  await adapter.reset();
  await reloadAll();
  requestRender();
  toast("예시 데이터로 초기화했습니다.");
}
