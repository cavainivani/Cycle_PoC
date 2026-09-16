/* =========================================================
   DEMO SEED DATA
   -----------------------------------------------------------
   DB 없이 화면을 클릭해 볼 수 있도록 하는 예시 데이터.
   모든 레코드에 isSample:true 가 붙으므로 상단 배너의
   "샘플 데이터 정리" 버튼으로 한 번에 지울 수 있다.

   날짜는 "오늘" 기준 상대값으로 생성된다. 언제 열어도 수습 종료
   임박자 / 계약 만료 임박자 / 진행 중 지원금이 실제로 보이게 하기
   위한 것이고, 실제 데이터를 붙이면 이 파일은 통째로 지우면 된다.
   ========================================================= */

const MS_DAY = 86400000;

function iso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
/** 오늘로부터 n일 뒤(음수면 이전) 날짜 */
function day(n) {
  return iso(new Date(Date.now() + n * MS_DAY));
}
/** 오늘로부터 n개월 뒤(음수면 이전) 날짜 */
function month(n) {
  const d = new Date();
  const target = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(target, last));
  return iso(d);
}
/** 오늘로부터 n개월 뒤의 YYYY-MM */
function ym(n) {
  return month(n).slice(0, 7);
}
const thisYear = new Date().getFullYear();

const emptyResume = () => ({ education: [], careerHistory: [], certifications: [], skills: [] });

/**
 * 항목별 평가를 앱이 기대하는 형태로 만든다.
 * EVAL_ITEMS 순서(기술력·업무이해도·발전가능성·근태·태도·조직적응도)대로 등급(A~D)을 넘긴다.
 * 저장 형태는 [{key, grade, comment}] 배열 — readEvalItems() 가 만드는 것과 동일하다.
 */
const ITEM_KEYS = ["기술력", "업무이해도", "발전가능성", "근태", "태도", "조직적응도"];
function items(grades, comments) {
  return ITEM_KEYS.map((key, i) => ({
    key,
    grade: grades[i] || "B",
    comment: (comments && comments[i]) || "",
  }));
}

/* ---------- 직원 ---------- */
const employees = [
  {
    key: "kim", name: "김서연", empNo: "MCB-0101", division: "D365", position: "책임",
    employmentType: "일반직", status: "근무", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1990-04-12", hireDate: month(-38), workStartDate: month(-38),
    phone: "010-2345-6781", email: "seoyeon.kim@example.com", currentSalary: 6200,
    lastContractDate: month(-11), subsidyEligible: "아니오",
    resume: {
      education: [{ school: "한국대학교", major: "컴퓨터공학", degree: "학사", period: "2009.03 ~ 2013.02" }],
      careerHistory: [{ company: "넥스트소프트", role: "ERP 컨설턴트", period: "2013.03 ~ 2022.06", description: "제조 D365 F&O 구축 5건 수행" }],
      certifications: ["MB-330", "정보처리기사"],
      skills: ["D365 F&O", "X++", "Power BI"],
    },
    currentTasks: [
      { title: "A사 D365 F&O 고도화", detail: "생산관리 모듈 커스터마이징 · 2분기 오픈 목표" },
      { title: "사내 기술 세미나 운영", detail: "월 1회 D365 신기능 공유" },
    ],
    probation: {},
  },
  {
    key: "park", name: "박지훈", empNo: "MCB-0102", division: "Ai agent", position: "수석",
    employmentType: "일반직", status: "근무", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1986-11-03", hireDate: month(-56), workStartDate: month(-56),
    phone: "010-2345-6782", email: "jihoon.park@example.com", currentSalary: 8400,
    lastContractDate: month(-2), subsidyEligible: "아니오",
    resume: {
      education: [{ school: "서울공과대학교", major: "산업공학", degree: "석사", period: "2010.03 ~ 2012.02" }],
      careerHistory: [{ company: "클라우드웍스", role: "AI 솔루션 리드", period: "2012.03 ~ 2021.12", description: "챗봇·RPA 도입 프로젝트 총괄" }],
      certifications: ["AZ-104", "PMP"],
      skills: ["LLM 응용", "Azure OpenAI", "Python"],
    },
    currentTasks: [{ title: "AI 에이전트 플랫폼 아키텍처", detail: "멀티 에이전트 오케스트레이션 설계" }],
    probation: {},
  },
  {
    key: "lee", name: "이도현", empNo: "MCB-0103", division: "Ai 365", position: "선임",
    employmentType: "일반직", status: "수습", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1996-02-20", hireDate: day(-72), workStartDate: day(-72),
    phone: "010-2345-6783", email: "dohyun.lee@example.com", currentSalary: 4300,
    lastContractDate: day(-72), subsidyEligible: "진행중",
    resume: {
      education: [{ school: "중앙대학교", major: "소프트웨어학", degree: "학사", period: "2015.03 ~ 2021.02" }],
      careerHistory: [{ company: "스타트업 L", role: "백엔드 개발자", period: "2021.03 ~ 2025.05", description: "SaaS 백엔드 API 개발" }],
      certifications: ["SQLD"],
      skills: ["Node.js", "Azure Functions", "TypeScript"],
    },
    currentTasks: [{ title: "Ai 365 코파일럿 연동", detail: "Teams 봇 연동 POC" }],
    // 수습 종료가 12일 뒤 -> "수습 평가 대상자"로 잡힌다
    probation: {
      startDate: day(-72), endDate: day(12), finalDecision: "대기", finalDecisionDate: "", finalComment: "",
      evaluations: [
        {
          evalDate: day(-30), evaluator: "박지훈", score: 82, grade: "B",
          items: items(
            ["A", "B", "A", "B", "B", "B"],
            ["신규 기술 습득이 빠름", "도메인 이해는 보강 필요", "피드백 수용이 적극적", "", "", "팀 합류 후 적응 순조로움"]
          ),
          comment: "학습 속도가 빠르고 질문의 질이 좋음. 도메인 지식 보강 필요.",
          finalOpinion: "정규직 전환 권고",
        },
      ],
    },
  },
  {
    key: "choi", name: "최유진", empNo: "MCB-0104", division: "관리", position: "과장",
    employmentType: "일반직", status: "근무", workType: "출산휴가", recruitType: "정직원",
    location: "한국", birthDate: "1992-07-30", hireDate: month(-44), workStartDate: month(-44),
    phone: "010-2345-6784", email: "yujin.choi@example.com", currentSalary: 5400,
    lastContractDate: month(-8), subsidyEligible: "완료",
    leaveStartDate: month(-2), leaveExpectedReturnDate: month(4),
    resume: emptyResume(), currentTasks: [], probation: {},
  },
  {
    key: "jung", name: "정민호", empNo: "MCB-0105", division: "영업 마케팅", position: "차장",
    employmentType: "일반직", status: "근무", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1988-09-15", hireDate: month(-29), workStartDate: month(-29),
    phone: "010-2345-6785", email: "minho.jung@example.com", currentSalary: 6800,
    // 최종 계약일이 11개월여 전 -> 만 1년 시점이 가까워 "계약 갱신 대기 리스트"에 잡힌다
    lastContractDate: day(-352), subsidyEligible: "아니오",
    resume: emptyResume(),
    currentTasks: [{ title: "2분기 파이프라인 관리", detail: "신규 리드 40건 팔로업" }],
    probation: {},
  },
  {
    key: "kang", name: "강하늘", empNo: "MCB-0106", division: "유지보수", position: "대리",
    employmentType: "계약직", status: "근무", workType: "일반근무", recruitType: "계약직",
    location: "한국", birthDate: "1994-12-05", hireDate: month(-19), workStartDate: month(-19),
    phone: "010-2345-6786", email: "haneul.kang@example.com", currentSalary: 4600,
    lastContractDate: month(-7), subsidyEligible: "대기",
    resume: emptyResume(),
    currentTasks: [{ title: "고객사 정기 점검", detail: "월 2회 운영 리포트 발행" }],
    probation: {},
  },
  {
    key: "yoon", name: "윤채원", empNo: "MCB-0107", division: "교육 사업", position: "선임",
    employmentType: "일반직", status: "근무", workType: "육아단축근무", recruitType: "정직원",
    location: "한국", birthDate: "1993-03-22", hireDate: month(-33), workStartDate: month(-33),
    phone: "010-2345-6787", email: "chaewon.yoon@example.com", currentSalary: 5100,
    lastContractDate: month(-5), subsidyEligible: "진행중",
    leaveStartDate: month(-3), leaveExpectedReturnDate: month(9),
    resume: emptyResume(),
    currentTasks: [{ title: "신입 온보딩 교육 과정 개편", detail: "D365 기초 커리큘럼 리뉴얼" }],
    probation: {},
  },
  {
    key: "oh", name: "오세훈", empNo: "MCB-0108", division: "D365", position: "선임",
    employmentType: "일반직", status: "수습", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1997-08-08", hireDate: day(-28), workStartDate: day(-28),
    phone: "010-2345-6788", email: "sehun.oh@example.com", currentSalary: 4100,
    lastContractDate: day(-28), subsidyEligible: "아니오",
    resume: emptyResume(),
    currentTasks: [{ title: "B사 마이그레이션 지원", detail: "데이터 정합성 검증" }],
    // 수습 종료까지 62일 -> 아직 알림 대상은 아님
    probation: { startDate: day(-28), endDate: day(62), finalDecision: "대기", finalDecisionDate: "", finalComment: "", evaluations: [] },
  },
  {
    key: "han", name: "한지우", empNo: "MCB-0109", division: "Ai agent", position: "책임",
    employmentType: "외주업체", status: "근무", workType: "일반근무", recruitType: "계약직",
    location: "해외", birthDate: "1991-05-19", hireDate: month(-14), workStartDate: month(-14),
    phone: "010-2345-6789", email: "jiwoo.han@example.com", currentSalary: 5900,
    lastContractDate: month(-14), subsidyEligible: "아니오",
    resume: emptyResume(),
    currentTasks: [{ title: "해외 고객사 PoC", detail: "싱가포르 리테일 고객 대상" }],
    probation: {},
  },
  {
    key: "shin", name: "신아름", empNo: "MCB-0110", division: "관리", position: "대리",
    employmentType: "일반직", status: "근무", workType: "기타", recruitType: "정직원",
    location: "한국", birthDate: "1995-10-11", hireDate: month(-22), workStartDate: month(-22),
    phone: "010-2345-6790", email: "areum.shin@example.com", currentSalary: 4400,
    lastContractDate: month(-10), subsidyEligible: "대기",
    leaveStartDate: month(-1), leaveExpectedReturnDate: month(5),
    resume: emptyResume(), currentTasks: [], probation: {},
  },
  {
    key: "bae", name: "배준영", empNo: "MCB-0111", division: "유지보수", position: "부장",
    employmentType: "일반직", status: "퇴사", workType: "일반근무", recruitType: "정직원",
    location: "한국", birthDate: "1983-01-27", hireDate: month(-71), workStartDate: month(-71),
    phone: "010-2345-6791", email: "junyoung.bae@example.com", currentSalary: 7600,
    lastContractDate: month(-18), subsidyEligible: "아니오",
    resume: emptyResume(), currentTasks: [], probation: {},
  },
  {
    key: "song", name: "송가은", empNo: "MCB-0112", division: "교육 사업", position: "선임",
    employmentType: "계약직", status: "근무", workType: "일반근무", recruitType: "계약직",
    location: "한국", birthDate: "1998-06-14", hireDate: month(-9), workStartDate: month(-9),
    phone: "010-2345-6792", email: "gaeun.song@example.com", currentSalary: 3900,
    lastContractDate: month(-9), subsidyEligible: "아니오",
    resume: emptyResume(),
    currentTasks: [{ title: "교육 교재 제작", detail: "Power Platform 실습서" }],
    probation: {},
  },
];

/* ---------- 계약 ---------- */
const contracts = [
  { emp: "kim",  contractType: "연봉계약",       startDate: month(-11), endDate: month(1),   annualSalary: 6200, signingBonus: 0,   recruitingFee: 0,   changeReason: "연봉인상", signedDate: month(-11), status: "완료" },
  { emp: "park", contractType: "연봉계약",       startDate: month(-2),  endDate: month(10),  annualSalary: 8400, signingBonus: 300, recruitingFee: 0,   changeReason: "연봉인상", signedDate: month(-2),  status: "완료" },
  { emp: "lee",  contractType: "수습계약",       startDate: day(-72),   endDate: day(12),    annualSalary: 4300, signingBonus: 0,   recruitingFee: 400, changeReason: "신규",     signedDate: day(-72),   status: "완료" },
  { emp: "jung", contractType: "정규직 근로계약", startDate: day(-352),  endDate: day(13),    annualSalary: 6800, signingBonus: 0,   recruitingFee: 0,   changeReason: "재계약",   signedDate: day(-352),  status: "대기" },
  { emp: "kang", contractType: "계약직 근로계약", startDate: month(-7),  endDate: day(24),    annualSalary: 4600, signingBonus: 0,   recruitingFee: 0,   changeReason: "연장",     signedDate: month(-7),  status: "대기" },
  { emp: "yoon", contractType: "연봉계약",       startDate: month(-5),  endDate: month(7),   annualSalary: 5100, signingBonus: 0,   recruitingFee: 0,   changeReason: "연봉인상", signedDate: month(-5),  status: "완료" },
  { emp: "oh",   contractType: "수습계약",       startDate: day(-28),   endDate: day(62),    annualSalary: 4100, signingBonus: 0,   recruitingFee: 350, changeReason: "신규",     signedDate: day(-28),   status: "완료" },
  { emp: "han",  contractType: "프리랜서 계약",   startDate: month(-14), endDate: month(-2),  annualSalary: 5900, signingBonus: 0,   recruitingFee: 0,   changeReason: "신규",     signedDate: month(-14), status: "완료" },
  { emp: "song", contractType: "계약직 근로계약", startDate: month(-9),  endDate: month(3),   annualSalary: 3900, signingBonus: 0,   recruitingFee: 0,   changeReason: "신규",     signedDate: month(-9),  status: "완료" },
  { emp: "choi", contractType: "연봉계약",       startDate: month(-8),  endDate: month(4),   annualSalary: 5400, signingBonus: 0,   recruitingFee: 0,   changeReason: "연봉인상", signedDate: month(-8),  status: "완료" },
];

/* ---------- 프로젝트 ---------- */
const projects = [
  { key: "p1", name: "A사 D365 F&O 고도화" },
  { key: "p2", name: "AI 에이전트 플랫폼 구축" },
  { key: "p3", name: "B사 ERP 마이그레이션" },
];

/* ---------- 프로젝트 평가 ---------- */
const projectEvals = [
  { emp: "kim",  proj: "p1", role: "PL",      period: "2026.01 ~ 2026.06", score: 91, evaluator: "박지훈", evalDate: month(-3), strengths: "일정 관리와 고객 커뮤니케이션이 안정적", improvements: "산출물 문서화 표준 준수 필요" },
  { emp: "park", proj: "p2", role: "아키텍트", period: "2026.02 ~ 2026.08", score: 95, evaluator: "대표이사", evalDate: month(-1), strengths: "복잡한 요구사항을 단순한 구조로 정리", improvements: "주니어 대상 지식 전파 확대" },
  { emp: "lee",  proj: "p3", role: "개발",     period: "2026.06 ~ 2026.09", score: 78, evaluator: "김서연", evalDate: month(-1), strengths: "적극적인 태도와 빠른 습득", improvements: "테스트 커버리지 보완" },
  { emp: "kang", proj: "p3", role: "운영지원", period: "2026.03 ~ 2026.09", score: 84, evaluator: "김서연", evalDate: month(-2), strengths: "장애 대응이 신속", improvements: "예방 점검 체계화" },
];

/* ---------- 연간 평가 ---------- */
const annualEvals = [
  { emp: "kim",  year: thisYear - 1, grade: "A", score: 89, evaluator: "박지훈", evalDate: `${thisYear - 1}-12-15`, items: items(["A", "A", "B", "A", "A", "A"]), comment: "핵심 프로젝트를 안정적으로 리드함.", promotionOpinion: "차기 수석 승진 후보로 검토 권고" },
  { emp: "park", year: thisYear - 1, grade: "S", score: 96, evaluator: "대표이사", evalDate: `${thisYear - 1}-12-15`, items: items(["A", "A", "A", "A", "A", "A"]), comment: "조직 전체의 기술 방향을 견인.", promotionOpinion: "즉시 승진 대상" },
  { emp: "jung", year: thisYear - 1, grade: "B", score: 80, evaluator: "대표이사", evalDate: `${thisYear - 1}-12-15`, items: items(["C", "B", "B", "A", "B", "B"]), comment: "목표 달성률 안정적.", promotionOpinion: "유지" },
  { emp: "yoon", year: thisYear - 1, grade: "A", score: 87, evaluator: "최유진", evalDate: `${thisYear - 1}-12-15`, items: items(["B", "A", "A", "B", "A", "B"]), comment: "교육 만족도 개선에 기여.", promotionOpinion: "책임 승진 검토" },
];

/* ---------- 상시 평가 (무기명) ---------- */
const regularEvals = [
  { emp: "lee",  evalDate: day(-18), grade: "B", items: items(["B", "C", "A", "B", "A", "B"]), comment: "협업 태도가 좋고 피드백 수용이 빠름." },
  { emp: "kang", evalDate: day(-40), grade: "A", items: items(["A", "A", "B", "A", "A", "A"]), comment: "운영 이슈 공유가 투명함." },
  { emp: "oh",   evalDate: day(-9),  grade: "B", items: items(["C", "C", "A", "A", "B", "B"]), comment: "온보딩 진행 순조로움." },
];

/* ---------- 지원금 마스터 ---------- */
const subsidyPrograms = [
  { key: "sp1", name: "청년 디지털 일자리 지원금", amount: 180, months: 6, notes: "만 34세 이하 신규 채용 인원 대상" },
  { key: "sp2", name: "출산육아기 고용안정 장려금", amount: 240, months: 12, notes: "출산휴가·육아휴직 사용 인원 대상" },
  { key: "sp3", name: "고용유지 지원금", amount: 120, months: 3, notes: "경영상 필요에 따른 휴업·휴직 시" },
  { key: "sp4", name: "직무전환 교육 지원금", amount: 90, months: 0, notes: "1회성 지급. 교육 수료 확인서 필요" },
];

/* ---------- 지원금 신청 ---------- */
const subsidyApps = [
  {
    emp: "lee", program: "sp1", status: "진행", paymentType: "월별", monthsCount: 6,
    monthlyAmount: 30, periodStart: month(-2), periodEnd: month(4), totalAmount: 180,
    notes: "고용보험 취득 확인 완료",
    months: [
      { ym: ym(-2), submitted: true,  amount: 30 },
      { ym: ym(-1), submitted: true,  amount: 30 },
      { ym: ym(0),  submitted: false, amount: 30 },
      { ym: ym(1),  submitted: false, amount: 30 },
      { ym: ym(2),  submitted: false, amount: 30 },
      { ym: ym(3),  submitted: false, amount: 30 },
    ],
  },
  {
    emp: "choi", program: "sp2", status: "완료", paymentType: "월별", monthsCount: 4,
    monthlyAmount: 60, periodStart: month(-4), periodEnd: month(0), totalAmount: 240,
    notes: "전 기간 제출 완료",
    months: [
      { ym: ym(-4), submitted: true, amount: 60 },
      { ym: ym(-3), submitted: true, amount: 60 },
      { ym: ym(-2), submitted: true, amount: 60 },
      { ym: ym(-1), submitted: true, amount: 60 },
    ],
  },
  {
    emp: "yoon", program: "sp2", status: "진행", paymentType: "월별", monthsCount: 5,
    monthlyAmount: 48, periodStart: month(-3), periodEnd: month(2), totalAmount: 240,
    notes: "육아단축근무 확인서 제출됨",
    months: [
      { ym: ym(-3), submitted: true,  amount: 48 },
      { ym: ym(-2), submitted: true,  amount: 48 },
      { ym: ym(-1), submitted: false, amount: 48 },
      { ym: ym(0),  submitted: false, amount: 48 },
      { ym: ym(1),  submitted: false, amount: 48 },
    ],
  },
  {
    emp: "kang", program: "sp3", status: "대기", paymentType: "월별", monthsCount: 3,
    monthlyAmount: 40, periodStart: month(0), periodEnd: month(3), totalAmount: 120,
    notes: "신청 서류 준비 중",
    months: [
      { ym: ym(0), submitted: false, amount: 40 },
      { ym: ym(1), submitted: false, amount: 40 },
      { ym: ym(2), submitted: false, amount: 40 },
    ],
  },
  {
    emp: "shin", program: "sp4", status: "대기", paymentType: "1회성", monthsCount: 1,
    monthlyAmount: 90, periodStart: month(0), periodEnd: "", totalAmount: 90,
    notes: "교육 수료 확인서 대기",
    months: [{ ym: ym(0), submitted: false, amount: 90 }],
  },
];

/**
 * 어댑터에 넣을 수 있는 형태로 시드 데이터를 만든다.
 * 반환값: { [collectionPath]: Array<record> } — 각 레코드에 id가 이미 부여되어 있다.
 */
export function buildSeedData() {
  const now = new Date().toISOString();
  const empId = {};
  const projId = {};
  const progId = {};

  const employeeDocs = employees.map((e, i) => {
    const id = `seed-emp-${String(i + 1).padStart(3, "0")}`;
    empId[e.key] = id;
    const { key, ...rest } = e;
    return {
      id,
      leaveStartDate: "", leaveExpectedReturnDate: "", leaveProgramId: "",
      ...rest,
      isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  const projectDocs = projects.map((p, i) => {
    const id = `seed-prj-${String(i + 1).padStart(3, "0")}`;
    projId[p.key] = id;
    return { id, name: p.name, isSample: true, createdAt: now, _ord: i + 1 };
  });

  const programDocs = subsidyPrograms.map((p, i) => {
    const id = `seed-spg-${String(i + 1).padStart(3, "0")}`;
    progId[p.key] = id;
    const { key, ...rest } = p;
    return { id, ...rest, isSample: true, createdAt: now, _ord: i + 1 };
  });

  const nameOf = (key) => (employees.find((e) => e.key === key) || {}).name || "";

  // workType이 "기타"인 인원은 지원금 항목과 연결해 둔다 (휴가자 관리 화면에서 항목명이 보이도록)
  const shin = employeeDocs.find((e) => e.id === empId.shin);
  if (shin) shin.leaveProgramId = progId.sp4;

  const contractDocs = contracts.map((c, i) => {
    const { emp, ...rest } = c;
    return {
      id: `seed-ctr-${String(i + 1).padStart(3, "0")}`,
      employeeId: empId[emp], employeeName: nameOf(emp),
      ...rest, isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  const projectEvalDocs = projectEvals.map((e, i) => {
    const { emp, proj, ...rest } = e;
    return {
      id: `seed-pev-${String(i + 1).padStart(3, "0")}`,
      employeeId: empId[emp], employeeName: nameOf(emp),
      projectId: projId[proj], projectName: (projects.find((p) => p.key === proj) || {}).name || "",
      ...rest, isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  const annualEvalDocs = annualEvals.map((e, i) => {
    const { emp, ...rest } = e;
    return {
      id: `seed-aev-${String(i + 1).padStart(3, "0")}`,
      employeeId: empId[emp], employeeName: nameOf(emp),
      ...rest, isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  const regularEvalDocs = regularEvals.map((e, i) => {
    const { emp, ...rest } = e;
    return {
      id: `seed-rev-${String(i + 1).padStart(3, "0")}`,
      employeeId: empId[emp], employeeName: nameOf(emp),
      ...rest, isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  const subsidyAppDocs = subsidyApps.map((a, i) => {
    const { emp, program, months, ...rest } = a;
    const programName = (subsidyPrograms.find((p) => p.key === program) || {}).name || "";
    return {
      id: `seed-sap-${String(i + 1).padStart(3, "0")}`,
      employeeId: empId[emp], employeeName: nameOf(emp),
      programId: progId[program], program: programName,
      months: months.map((m) => ({ ...m, item: programName })),
      ...rest, isSample: true, createdAt: now, _ord: i + 1,
    };
  });

  return {
    employees: employeeDocs,
    projects: projectDocs,
    subsidy_programs: programDocs,
    contracts: contractDocs,
    project_evaluations: projectEvalDocs,
    annual_evaluations: annualEvalDocs,
    regular_evaluations: regularEvalDocs,
    subsidy_applications: subsidyAppDocs,
  };
}
