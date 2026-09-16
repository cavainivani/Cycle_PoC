/* 인력 마스터 목록에서 쓰는 직원 관련 조회 헬퍼 */
import { state } from "../data/store.js";
export function latestContractOf(empId){
  const cs = state.contracts.filter(c=>c.employeeId===empId && c.status!=="완료").sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));
  return cs[0] || null;
}
export function latestProbationEvalDate(emp){
  const evs = (emp.probation && emp.probation.evaluations) || [];
  if(!evs.length) return null;
  return [...evs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0].date || null;
}
