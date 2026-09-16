export const EMPLOYMENT_TYPE_OPTIONS = ["일반직","계약직","외주업체"];
export const WORK_TYPE_OPTIONS = ["일반근무","출산휴가","육아단축근무","기타"];
export const DIVISION_OPTIONS = ["D365","Ai agent","Ai 365","관리","영업 마케팅","유지보수","교육 사업"];
export const RECRUIT_TYPE_OPTIONS = ["정직원","계약직"];
export const LOCATION_OPTIONS = ["한국","해외"];
export const POSITION_OPTIONS = ["선임","책임","수석","대리","과장","차장","부장","이사","대표이사"];
export const SUBSIDY_STATUS_OPTIONS = ["대기","진행","완료"];
export function subsidyStatusTone(s){ return {"대기":"muted","진행":"info","완료":"success"}[s] || "muted"; }
// 인력 마스터의 "지원금 대상자" 필드 값 -- 단순 예/아니오 플래그가 아니라 지원금 신청 진행 상태를 그대로 반영하는 상태값.
// 지원금 신청(subsidy_applications)의 status(대기/진행/완료)가 바뀔 때마다 syncEmployeeSubsidyStatus()가 이 값을 갱신한다.
export const SUBSIDY_EMP_STATUS_OPTIONS = ["아니오","대기","진행중","완료"];
export const SUBSIDY_APP_STATUS_TO_EMP_FIELD = { "대기":"대기", "진행":"진행중", "완료":"완료" };
export const SUBSIDY_EMP_STATUS_RANK = { "아니오":0, "대기":1, "진행중":2, "완료":3 };
export function subsidyEmpStatusTone(s){ return {"대기":"warning","진행중":"info","완료":"success"}[s] || "muted"; }
export const EVAL_ITEMS = [
  {key:"기술력", desc:"직무 수행에 필요한 실무 능력, 업무 처리 수준, 기술 숙련도"},
  {key:"업무이해도", desc:"업무 지시 이해도, 업무 프로세스 및 직무 이해 수준"},
  {key:"발전가능성", desc:"피드백 수용 태도, 학습의지, 성장 잠재력"},
  {key:"근태", desc:"출퇴근 시간 준수, 지각·결근 여부, 근무 성실도"},
  {key:"태도", desc:"업무에 임하는 자세, 책임감, 성실성, 규정 준수 여부"},
  {key:"조직적응도", desc:"조직문화 적응력, 협업 태도, 동료와의 관계, 융화력"},
];
