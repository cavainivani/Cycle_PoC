export const TODAY = new Date().toISOString().slice(0,10);
export function todayISO(){ return new Date().toISOString().slice(0,10); }
export function esc(s){ return (s==null?"":String(s)).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
export function fmtDate(d){ if(!d) return "—"; return String(d).replaceAll("-", "."); }
export function fmtWon(m){ if(m===undefined||m===null||m==="") return "—"; return Number(m).toLocaleString("ko-KR")+"만원"; }
/**
 * 날짜에 개월을 더한다. "YYYY-MM-DD" -> "YYYY-MM-DD"
 *
 * ★ UTC 로 계산한다.
 *   예전에는 "T00:00:00" (로컬) 로 파싱하고 toISOString() (UTC) 으로
 *   내보내서, KST 에서는 결과가 늘 하루씩 앞당겨졌다. 수습 3개월도
 *   계약 만 1년도 전부 -1일이었다.
 *
 * ★ 말일은 다음 달 말일로 맞춘다.
 *   1월 31일 + 1개월은 3월 3일이 아니라 2월 28일이어야 한다.
 *   (seed.js 의 month() 헬퍼도 같은 규칙을 쓴다)
 */
export function addMonths(dateStr, n){
  const d = new Date(dateStr+"T00:00:00Z");
  if(isNaN(d)) return "";
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth()+n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0,10);
}
export function monthsBetween(start, end){
  if(!start || !end) return [];
  let d = new Date(start+"T00:00:00");
  const endD = new Date(end+"T00:00:00");
  if(isNaN(d) || isNaN(endD) || d>endD) return [];
  d.setDate(1); endD.setDate(1);
  const out = [];
  let guard = 0;
  while(d<=endD && guard<240){
    out.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));
    d.setMonth(d.getMonth()+1);
    guard++;
  }
  return out;
}
export function fmtYm(ym){ if(!ym) return "—"; const [y,m]=ym.split("-"); return `${y}년 ${Number(m)}월`; }
export function daysUntil(dateStr){
  if(!dateStr) return null;
  const a = new Date(todayISO()+"T00:00:00"), b = new Date(dateStr+"T00:00:00");
  if(isNaN(b)) return null;
  return Math.round((b-a)/86400000);
}
export function initials(name){ return (name||"?").trim().slice(0,1); }
export function ddayLabel(dateStr){
  const d = daysUntil(dateStr);
  if(d===null) return "—";
  if(d===0) return "D-day";
  return d>0 ? `D-${d}` : `D+${-d}`;
}
export function ageFromBirth(birthDate){
  if(!birthDate) return null;
  const b = new Date(birthDate+"T00:00:00"), t = new Date(todayISO()+"T00:00:00");
  if(isNaN(b)) return null;
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if(m<0 || (m===0 && t.getDate()<b.getDate())) age--;
  return age;
}
export function yearsMonthsLabel(fromDate, toDate){
  if(!fromDate) return "—";
  const a = new Date(fromDate+"T00:00:00");
  const b = toDate ? new Date(toDate+"T00:00:00") : new Date(todayISO()+"T00:00:00");
  if(isNaN(a) || isNaN(b) || b<a) return "—";
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  if(b.getDate() < a.getDate()) months--;
  if(months<0){ years--; months+=12; }
  if(years<=0 && months<=0) return "1개월 미만";
  return (years>0 ? `${years}년 ` : "") + `${months}개월`;
}
export function monthsRemaining(endDate){
  if(!endDate) return null;
  const t = new Date(todayISO()+"T00:00:00"), e = new Date(endDate+"T00:00:00");
  if(isNaN(e)) return null;
  let months = (e.getFullYear()-t.getFullYear())*12 + (e.getMonth()-t.getMonth());
  if(e.getDate() < t.getDate()) months--;
  return months;
}
export function monthsSinceNum(dateStr){
  if(!dateStr) return null;
  const a = new Date(dateStr+"T00:00:00"), b = new Date(todayISO()+"T00:00:00");
  if(isNaN(a)) return null;
  let months = (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth());
  if(b.getDate() < a.getDate()) months--;
  return Math.max(0, months);
}
export function ymLabelFromMonths(totalMonths){
  if(totalMonths===null || totalMonths===undefined || isNaN(totalMonths)) return "—";
  const years = Math.floor(totalMonths/12), months = Math.round(totalMonths%12);
  if(years<=0 && months<=0) return "1개월 미만";
  return (years>0?`${years}년 `:"")+`${months}개월`;
}
export function byId(id){ return document.getElementById(id); }
export function uid(prefix){ return prefix+"_"+Math.random().toString(36).slice(2,9); }
