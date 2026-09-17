/* =========================================================
   DATA SCHEMA  (문서이자 코드)
   -----------------------------------------------------------
   이 파일은 "각 화면이 어떤 데이터를 바라보는가"의 단일 기준점이다.
   실제 DB를 붙일 때는 여기 정의된 컬렉션/필드를 그대로 테이블
   설계의 출발점으로 쓰면 된다.

   COLLECTIONS 의 key = 어댑터가 쓰는 컬렉션 경로(스토리지 키),
   stateKey = 화면 코드에서 읽는 state.<stateKey> 배열 이름.

   화면별 사용처는 docs/DATA-MAP.md 에 표로 정리되어 있다.
   ========================================================= */

/** @typedef {"text"|"number"|"date"|"month"|"select"|"bool"|"ref"|"object"|"array"} FieldType */

export const COLLECTIONS = {
  employees: {
    stateKey: "employees",
    label: "직원 (인력 마스터)",
    describes: "회사에 소속된 모든 인원의 기준 정보. 나머지 거의 모든 컬렉션이 employeeId 로 이 컬렉션을 참조한다.",
    usedBy: ["dashboard", "employees", "probation", "contracts", "leave", "subsidy", "evaluations", "hrReport"],
    fields: {
      id:                      { type: "text",   label: "ID",            note: "어댑터가 발급. 수정 불가." },
      name:                    { type: "text",   label: "이름",           required: true },
      empNo:                   { type: "text",   label: "사번" },
      division:                { type: "select", label: "사업부",         options: "DIVISION_OPTIONS", note: "역할별 노출 범위(visibleDivisions) 필터의 기준 필드." },
      position:                { type: "select", label: "직급/직책",      options: "POSITION_OPTIONS" },
      employmentType:          { type: "select", label: "고용형태",       options: "EMPLOYMENT_TYPE_OPTIONS" },
      status:                  { type: "select", label: "재직상태",       options: ["수습", "근무", "퇴사"], note: "\"퇴사\"는 대부분의 집계에서 제외된다." },
      workType:                { type: "select", label: "근무형태",       options: "WORK_TYPE_OPTIONS", note: "일반근무 외 값이면 휴가자 관리 화면에 잡힌다." },
      leaveStartDate:          { type: "date",   label: "휴가 시작일" },
      leaveExpectedReturnDate: { type: "date",   label: "복귀 예정일" },
      leaveProgramId:          { type: "ref",    label: "연계 지원금 항목", ref: "subsidy_programs", note: "workType이 \"기타\"일 때만 사용." },
      recruitType:             { type: "select", label: "채용 타입",      options: "RECRUIT_TYPE_OPTIONS" },
      location:                { type: "select", label: "소속 위치",      options: "LOCATION_OPTIONS" },
      birthDate:               { type: "date",   label: "생년월일",       note: "나이는 저장하지 않고 ageFromBirth()로 계산." },
      hireDate:                { type: "date",   label: "입사일",         note: "근속기간 계산 기준." },
      workStartDate:           { type: "date",   label: "업무시작일" },
      phone:                   { type: "text",   label: "연락처" },
      email:                   { type: "text",   label: "이메일" },
      currentSalary:           { type: "number", label: "현재 연봉",      unit: "만원", note: "계약 등록 시 자동 갱신." },
      lastContractDate:        { type: "date",   label: "최종 계약일",    note: "계약 갱신 대상 판정(만 1년 시점)의 기준." },
      subsidyEligible:         { type: "select", label: "지원금 대상자",  options: "SUBSIDY_EMP_STATUS_OPTIONS", note: "지원금 신청 상태에 따라 syncEmployeeSubsidyStatus()가 자동 갱신." },
      probation:               { type: "object", label: "수습 정보",      shape: "ProbationInfo" },
      resume:                  { type: "object", label: "이력",           shape: "Resume" },
      currentTasks:            { type: "array",  label: "현재 업무",      of: "Task" },
      isSample:                { type: "bool",   label: "샘플 데이터 여부", note: "true면 화면에 \"샘플\" 태그가 붙고 일괄 삭제 대상이 된다." },
      createdAt:               { type: "text",   label: "생성 시각",      note: "ISO 문자열. 어댑터가 자동 부여." },
    },
    /** 중첩 객체 형태 */
    shapes: {
      ProbationInfo: {
        startDate:         { type: "date",   label: "수습 시작일" },
        endDate:           { type: "date",   label: "수습 종료 예정일", note: "보통 시작일 +3개월. 수습 평가 대상자 집계의 기준." },
        finalDecision:     { type: "select", label: "최종 판정", options: ["대기", "합격", "불합격", "연장"] },
        finalDecisionDate: { type: "date",   label: "판정일" },
        finalComment:      { type: "text",   label: "판정 의견" },
        evaluations:       { type: "array",  label: "수습 평가 이력", of: "ProbationEval" },
      },
      ProbationEval: {
        evalDate:     { type: "date",   label: "평가일" },
        evaluator:    { type: "text",   label: "평가자" },
        grade:        { type: "select", label: "종합 등급", options: ["S", "A", "B", "C", "D"] },
        score:        { type: "number", label: "종합 점수", note: "0~100" },
        items:        { type: "array",  label: "항목별 평가", of: "EvalItem" },
        comment:      { type: "text",   label: "코멘트" },
        finalOpinion: { type: "select", label: "정규직 전환 의견", options: ["정규직 전환 권고", "수습 연장 권고", "전환 불가"] },
      },
      /** readEvalItems() 가 만드는 형태. EVAL_ITEMS 순서대로 한 건씩 들어간다. */
      EvalItem: {
        key:     { type: "text",   label: "평가 항목명", note: "EVAL_ITEMS 의 key (기술력·업무이해도·발전가능성·근태·태도·조직적응도)" },
        grade:   { type: "select", label: "항목 등급", options: ["A", "B", "C", "D"] },
        comment: { type: "text",   label: "평가자 의견" },
      },
      Resume: {
        education:      { type: "array", label: "학력",   of: "{school, major, degree, period}" },
        careerHistory:  { type: "array", label: "경력",   of: "{company, role, period, description}" },
        certifications: { type: "array", label: "자격증", of: "string" },
        skills:         { type: "array", label: "스킬",   of: "string" },
      },
      Task: {
        title:  { type: "text", label: "업무명" },
        detail: { type: "text", label: "상세" },
      },
    },
  },

  contracts: {
    stateKey: "contracts",
    label: "계약",
    describes: "직원별 근로/연봉 계약 이력. 한 직원이 여러 건을 갖는다(최신 1건이 현재 계약).",
    usedBy: ["dashboard", "contracts", "employees", "hrReport"],
    fields: {
      id:            { type: "text",   label: "ID" },
      employeeId:    { type: "ref",    label: "직원",     ref: "employees", required: true },
      employeeName:  { type: "text",   label: "직원명",   note: "조회 편의를 위한 비정규화 필드. 실제 DB 연동 시 JOIN으로 대체 가능." },
      contractType:  { type: "select", label: "계약 구분", options: ["정규직 근로계약", "연봉계약", "수습계약", "계약직 근로계약", "프리랜서 계약"] },
      startDate:     { type: "date",   label: "계약 시작일", required: true },
      endDate:       { type: "date",   label: "계약 종료일", note: "30일 이내 만료 건이 대시보드에 집계된다." },
      annualSalary:  { type: "number", label: "연봉",       unit: "만원" },
      signingBonus:  { type: "number", label: "사이닝보너스", unit: "만원" },
      recruitingFee: { type: "number", label: "채용 수수료", unit: "만원" },
      changeReason:  { type: "select", label: "변경 사유",   options: ["신규", "연봉인상", "연장", "재계약", "조정"] },
      signedDate:    { type: "date",   label: "서명일" },
      status:        { type: "select", label: "상태",       options: ["대기", "지연", "완료"] },
      renewalStatus: { type: "select", label: "갱신 상태",   options: ["완료"], note: "갱신 모달로 등록된 건에만 붙는다." },
      isSample:      { type: "bool",   label: "샘플 여부" },
      createdAt:     { type: "text",   label: "생성 시각" },
    },
  },

  project_evaluations: {
    stateKey: "projectEvals",
    label: "프로젝트 평가",
    describes: "프로젝트 단위 수행 평가. 점수 → 등급 변환은 gradeFromScore()가 담당.",
    usedBy: ["evaluations", "employees"],
    fields: {
      id:           { type: "text",   label: "ID" },
      employeeId:   { type: "ref",    label: "직원",     ref: "employees", required: true },
      employeeName: { type: "text",   label: "직원명" },
      projectId:    { type: "ref",    label: "프로젝트", ref: "projects" },
      projectName:  { type: "text",   label: "프로젝트명", required: true },
      role:         { type: "text",   label: "역할" },
      period:       { type: "text",   label: "기간" },
      score:        { type: "number", label: "점수" },
      evaluator:    { type: "text",   label: "평가자",   required: true },
      evalDate:     { type: "date",   label: "평가일" },
      strengths:    { type: "text",   label: "강점" },
      improvements: { type: "text",   label: "개선점" },
      isSample:     { type: "bool",   label: "샘플 여부" },
      createdAt:    { type: "text",   label: "생성 시각" },
    },
  },

  annual_evaluations: {
    stateKey: "annualEvals",
    label: "연간 평가",
    describes: "연 단위 인사 평가. 등급(S~D)과 승진 의견을 포함.",
    usedBy: ["evaluations", "employees"],
    fields: {
      id:                { type: "text",   label: "ID" },
      employeeId:        { type: "ref",    label: "직원", ref: "employees", required: true },
      employeeName:      { type: "text",   label: "직원명" },
      year:              { type: "number", label: "평가 연도" },
      grade:             { type: "select", label: "등급", options: ["S", "A", "B", "C", "D"] },
      score:             { type: "number", label: "점수" },
      evaluator:         { type: "text",   label: "평가자", required: true },
      items:             { type: "array",  label: "항목별 평가", of: "EvalItem", note: "employees.shapes.EvalItem 과 동일한 형태" },
      evalDate:          { type: "date",   label: "평가일" },
      comment:           { type: "text",   label: "총평" },
      promotionOpinion:  { type: "text",   label: "승진 의견" },
      isSample:          { type: "bool",   label: "샘플 여부" },
      createdAt:         { type: "text",   label: "생성 시각" },
    },
  },

  regular_evaluations: {
    stateKey: "regularEvals",
    label: "상시 평가 (무기명)",
    describes: "수시로 남기는 무기명 평가. 평가자를 저장하지 않는 것이 이 컬렉션의 핵심 규칙이다.",
    usedBy: ["evaluations", "employees"],
    fields: {
      id:           { type: "text",   label: "ID" },
      employeeId:   { type: "ref",    label: "직원", ref: "employees", required: true },
      employeeName: { type: "text",   label: "직원명" },
      evalDate:     { type: "date",   label: "평가일" },
      grade:        { type: "select", label: "등급", options: ["S", "A", "B", "C", "D"] },
      items:        { type: "array",  label: "항목별 평가", of: "EvalItem", note: "employees.shapes.EvalItem 과 동일한 형태" },
      comment:      { type: "text",   label: "의견" },
      isSample:     { type: "bool",   label: "샘플 여부" },
      createdAt:    { type: "text",   label: "생성 시각" },
    },
  },

  subsidy_programs: {
    stateKey: "subsidyPrograms",
    label: "지원금 마스터",
    describes: "정부지원금 제도(항목) 카탈로그. 신청 건(subsidy_applications)이 이 항목을 참조한다.",
    usedBy: ["subsidyPrograms", "subsidy", "employees", "leave"],
    fields: {
      id:        { type: "text",   label: "ID" },
      name:      { type: "text",   label: "항목명", required: true },
      amount:    { type: "number", label: "지원 금액", unit: "만원" },
      months:    { type: "number", label: "지원 개월수" },
      notes:     { type: "text",   label: "비고" },
      isSample:  { type: "bool",   label: "샘플 여부" },
      createdAt: { type: "text",   label: "생성 시각" },
    },
  },

  subsidy_applications: {
    stateKey: "subsidyApps",
    label: "지원금 신청",
    describes: "직원별 지원금 신청 건. months[] 안의 월별 제출 여부가 수령액 집계의 원천이다.",
    usedBy: ["subsidy", "dashboard", "employees"],
    fields: {
      id:            { type: "text",   label: "ID" },
      employeeId:    { type: "ref",    label: "직원", ref: "employees", required: true },
      employeeName:  { type: "text",   label: "직원명" },
      programId:     { type: "ref",    label: "지원금 항목", ref: "subsidy_programs" },
      program:       { type: "text",   label: "지원금 항목명" },
      status:        { type: "select", label: "신청 상태", options: "SUBSIDY_STATUS_OPTIONS", note: "이 값이 바뀌면 직원의 subsidyEligible이 자동 동기화된다." },
      paymentType:   { type: "select", label: "지급 방식", options: ["월별", "1회성"] },
      monthsCount:   { type: "number", label: "지원 개월수" },
      monthlyAmount: { type: "number", label: "월 지원액", unit: "만원" },
      periodStart:   { type: "date",   label: "지원 시작일" },
      periodEnd:     { type: "date",   label: "지원 종료일" },
      totalAmount:   { type: "number", label: "총 지원액", unit: "만원" },
      notes:         { type: "text",   label: "비고" },
      months:        { type: "array",  label: "월별 내역", of: "SubsidyMonth" },
      isSample:      { type: "bool",   label: "샘플 여부" },
      createdAt:     { type: "text",   label: "생성 시각" },
    },
    shapes: {
      SubsidyMonth: {
        ym:        { type: "month",  label: "귀속 월", note: "YYYY-MM" },
        item:      { type: "text",   label: "항목명" },
        submitted: { type: "bool",   label: "제출 완료 여부", note: "true인 월의 amount만 수령액으로 합산된다." },
        amount:    { type: "number", label: "금액", unit: "만원" },
      },
    },
  },

  projects: {
    stateKey: "projects",
    label: "프로젝트",
    describes: "프로젝트 평가가 참조하는 프로젝트 목록. 현재 화면에서 직접 등록하는 UI는 없고 참조용으로만 쓰인다.",
    usedBy: ["evaluations"],
    fields: {
      id:        { type: "text", label: "ID" },
      name:      { type: "text", label: "프로젝트명" },
      isSample:  { type: "bool", label: "샘플 여부" },
      createdAt: { type: "text", label: "생성 시각" },
    },
  },
};

/** 어댑터가 다루는 모든 컬렉션 경로 */
export const COLLECTION_PATHS = Object.keys(COLLECTIONS);

/** 컬렉션 경로 -> state 배열 이름 (기존 코드의 PATH_KEY와 동일) */
export const PATH_KEY = Object.fromEntries(
  Object.entries(COLLECTIONS).map(([path, def]) => [path, def.stateKey])
);

/** state 배열 이름 -> 컬렉션 경로 (역방향) */
export const KEY_PATH = Object.fromEntries(
  Object.entries(PATH_KEY).map(([path, key]) => [key, path])
);

/**
 * 앱 설정 문서. 컬렉션이 아니라 단일 문서로 저장된다.
 * 실제 DB 연동 시 app_settings 테이블의 단일 행에 대응시키면 된다.
 */
export const SETTINGS_DOC = {
  path: "app_settings/system",
  fields: {
    visibleDivisions: { type: "object", label: "역할별 노출 사업부", note: "{admin:string[], pmo:string[]} — 빈 배열이면 전체 공개" },
    alertDays:        { type: "object", label: "알림 기준일",       note: "{probation:number, contract:number}" },
  },
  /**
   * 암호는 이 문서에 없다.
   *
   * rest 모드에서는 app_settings 테이블의 admin_password / pmo_password 에
   * scrypt 해시로 저장되고, 서버 밖으로 나오지 않는다. 검사는 서버가 하고
   * (POST /api/login), 변경도 별도 경로(POST /api/password)를 쓴다.
   * 브라우저는 암호를 가지지 않는다.
   *
   * local 모드(DB 없는 초안)만 예외로 localStorage 에 평문을 두고 화면에서
   * 비교한다 — 보안 장치가 아니라 클릭해 보기 위한 잠금이다.
   */
};
