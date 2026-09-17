/* 인력 마스터 목록에서 쓰는 직원 관련 조회 헬퍼 */
import { addMonths } from "../core/format.js";
import { state } from "../data/store.js";

/**
 * 가장 최근 계약 (시작일 기준). 완료된 계약도 포함한다.
 *
 * ★ 이것이 "최종 계약일 · 현재 연봉" 의 원천이다.
 *   예전에는 status!=="완료" 를 걸러냈는데, 완료 처리된 계약도 엄연히
 *   그 직원의 최신 계약이라 최종 계약일이 실제와 달라졌다.
 */
export function latestContractOf(empId){
  return pickLatestContract(state.contracts.filter(c=>c.employeeId===empId));
}

/**
 * 계약 목록에서 최신 한 건을 고른다.
 *
 * ★ 시작일이 같으면 나중에 등록한 것을 쓴다.
 *   같은 날 계약을 여러 번 등록하는 일은 흔하다(수정하려고 다시 넣는 등).
 *   시작일로만 비교하면 정렬이 갈리지 않아 먼저 등록한 계약이 뽑혔고,
 *   새로 입력한 연봉이 직원 마스터에 반영되지 않았다.
 */
export function pickLatestContract(list){
  if(!list || !list.length) return null;
  return [...list].sort(compareContractRecency)[0];
}

function compareContractRecency(a, b){
  const byStart = (b.startDate||"").localeCompare(a.startDate||"");
  if(byStart !== 0) return byStart;
  return (b.createdAt||"").localeCompare(a.createdAt||"");
}

/**
 * 계약의 재계약 예정일.
 * 종료일이 있으면 그 날, 없으면 시작일 + 12개월.
 *
 * 인력 마스터 목록과 계약 관리 대기 리스트가 같은 값을 보게 하려고
 * 한 곳에 모았다. 예전에는 목록이 계약 종료일을, 계약 관리가
 * "최종 계약일 + 12개월" 을 써서 두 화면이 다른 날짜를 보여 줬다.
 */
export function renewalDateOf(c){
  if(!c) return null;
  if(c.endDate) return c.endDate;
  return c.startDate ? addMonths(c.startDate, 12) : null;
}

export function latestProbationEvalDate(emp){
  const evs = (emp.probation && emp.probation.evaluations) || [];
  if(!evs.length) return null;
  return [...evs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0].date || null;
}
