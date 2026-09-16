/* =========================================================
   COLLECTION MAP  (문서 <-> 관계형 사이의 단일 변환 규칙)
   -----------------------------------------------------------
   프론트엔드 어댑터(src/data/adapters/rest.js)는 레코드를 "문서"
   하나로 주고받는다. 이 파일은 그 문서를 db/schema.sql 의 컬럼에
   어떻게 펼치고 다시 조립하는지를 한 곳에 모은 정의다.

   필드 정의의 원본은 src/data/schema.js 다. 거기에 필드를 추가하면
   여기에도 한 줄을 추가해야 저장된다.

   ★ columns 는 허용 목록(allowlist)이다.
     여기에 없는 키는 저장되지 않고 조용히 버려진다. 이는 의도된
     동작이다 — 화면이 보내는 _ord, key 같은 내부 값이 DB로 새는 것을
     막는다. 대신 새 필드를 추가할 때 여기를 빠뜨리면 그 필드만
     저장되지 않으므로, NODE_ENV!=production 이면 server/api.js 가
     버려진 키를 콘솔에 경고로 남긴다.

   type
     text     NVARCHAR      빈 문자열은 그대로 저장
     date     DATE          ""(빈 문자열) -> NULL 로 정규화
     int      INT           "" / NaN -> NULL
     decimal  DECIMAL(14,2) "" / NaN -> NULL
     bit      BIT           truthy -> 1
     json     NVARCHAR(MAX) JSON.stringify / JSON.parse
     datetime DATETIME2     ISO 문자열 <-> Date
   ========================================================= */

/**
 * 컬렉션 경로 -> 테이블 매핑.
 * key 는 src/data/schema.js 의 COLLECTIONS key 와 정확히 같아야 한다
 * (그대로 /api/:collection URL 세그먼트가 된다).
 */
export const COLLECTIONS = {
  employees: {
    table: "employees",
    columns: {
      name:                       { col: "name",                          type: "text" },
      empNo:                      { col: "emp_no",                        type: "text" },
      division:                   { col: "division",                      type: "text" },
      position:                   { col: "position",                      type: "text" },
      employmentType:             { col: "employment_type",               type: "text" },
      status:                     { col: "status",                        type: "text" },
      workType:                   { col: "work_type",                     type: "text" },
      leaveStartDate:             { col: "leave_start_date",              type: "date" },
      leaveExpectedReturnDate:    { col: "leave_expected_return_date",    type: "date" },
      leaveProgramId:             { col: "leave_program_id",              type: "text" },
      recruitType:                { col: "recruit_type",                  type: "text" },
      location:                   { col: "location",                      type: "text" },
      birthDate:                  { col: "birth_date",                    type: "date" },
      hireDate:                   { col: "hire_date",                     type: "date" },
      workStartDate:              { col: "work_start_date",               type: "date" },
      phone:                      { col: "phone",                         type: "text" },
      email:                      { col: "email",                         type: "text" },
      currentSalary:              { col: "current_salary",                type: "decimal" },
      lastContractDate:           { col: "last_contract_date",            type: "date" },
      subsidyEligible:            { col: "subsidy_eligible",              type: "text" },
      // 중첩 객체 probation 의 스칼라 부분 (집계 기준이라 컬럼으로 펼침)
      "probation.startDate":         { col: "probation_start_date",          type: "date" },
      "probation.endDate":           { col: "probation_end_date",            type: "date" },
      "probation.finalDecision":     { col: "probation_final_decision",      type: "text" },
      "probation.finalDecisionDate": { col: "probation_final_decision_date", type: "date" },
      "probation.finalComment":      { col: "probation_final_comment",       type: "text" },
      // 모양이 자유로운 중첩 문서
      resume:                     { col: "resume_json",                   type: "json" },
      currentTasks:               { col: "current_tasks_json",            type: "json" },
      isSample:                   { col: "is_sample",                     type: "bit" },
      createdAt:                  { col: "created_at",                    type: "datetime" },
    },
    children: {
      // employees.probation.evaluations[] -> probation_evaluations
      "probation.evaluations": {
        table: "probation_evaluations",
        parentCol: "employee_id",
        columns: {
          evalDate:     { col: "eval_date",     type: "date" },
          evaluator:    { col: "evaluator",     type: "text" },
          grade:        { col: "grade",         type: "text" },
          score:        { col: "score",         type: "decimal" },
          items:        { col: "items_json",    type: "json" },
          comment:      { col: "comment",       type: "text" },
          finalOpinion: { col: "final_opinion", type: "text" },
        },
      },
    },
  },

  contracts: {
    table: "contracts",
    columns: {
      employeeId:    { col: "employee_id",    type: "text" },
      employeeName:  { col: "employee_name",  type: "text" },
      contractType:  { col: "contract_type",  type: "text" },
      startDate:     { col: "start_date",     type: "date" },
      endDate:       { col: "end_date",       type: "date" },
      annualSalary:  { col: "annual_salary",  type: "decimal" },
      signingBonus:  { col: "signing_bonus",  type: "decimal" },
      recruitingFee: { col: "recruiting_fee", type: "decimal" },
      changeReason:  { col: "change_reason",  type: "text" },
      signedDate:    { col: "signed_date",    type: "date" },
      status:        { col: "status",         type: "text" },
      renewalStatus: { col: "renewal_status", type: "text" },
      isSample:      { col: "is_sample",      type: "bit" },
      createdAt:     { col: "created_at",     type: "datetime" },
    },
  },

  project_evaluations: {
    table: "project_evaluations",
    columns: {
      employeeId:   { col: "employee_id",   type: "text" },
      employeeName: { col: "employee_name", type: "text" },
      projectId:    { col: "project_id",    type: "text" },
      projectName:  { col: "project_name",  type: "text" },
      role:         { col: "[role]",        type: "text", plainCol: "role" },
      period:       { col: "period",        type: "text" },
      score:        { col: "score",         type: "decimal" },
      evaluator:    { col: "evaluator",     type: "text" },
      evalDate:     { col: "eval_date",     type: "date" },
      strengths:    { col: "strengths",     type: "text" },
      improvements: { col: "improvements",  type: "text" },
      isSample:     { col: "is_sample",     type: "bit" },
      createdAt:    { col: "created_at",    type: "datetime" },
    },
  },

  annual_evaluations: {
    table: "annual_evaluations",
    columns: {
      employeeId:       { col: "employee_id",       type: "text" },
      employeeName:     { col: "employee_name",     type: "text" },
      year:             { col: "eval_year",         type: "int" },
      grade:            { col: "grade",             type: "text" },
      score:            { col: "score",             type: "decimal" },
      evaluator:        { col: "evaluator",         type: "text" },
      items:            { col: "items_json",        type: "json" },
      evalDate:         { col: "eval_date",         type: "date" },
      comment:          { col: "comment",           type: "text" },
      promotionOpinion: { col: "promotion_opinion", type: "text" },
      isSample:         { col: "is_sample",         type: "bit" },
      createdAt:        { col: "created_at",        type: "datetime" },
    },
  },

  // ★ 무기명 — evaluator 를 일부러 매핑하지 않는다. 화면이 실수로
  //   보내더라도 allowlist 에 없으므로 저장되지 않는다.
  regular_evaluations: {
    table: "regular_evaluations",
    columns: {
      employeeId:   { col: "employee_id",   type: "text" },
      employeeName: { col: "employee_name", type: "text" },
      evalDate:     { col: "eval_date",     type: "date" },
      grade:        { col: "grade",         type: "text" },
      items:        { col: "items_json",    type: "json" },
      comment:      { col: "comment",       type: "text" },
      isSample:     { col: "is_sample",     type: "bit" },
      createdAt:    { col: "created_at",    type: "datetime" },
    },
  },

  subsidy_programs: {
    table: "subsidy_programs",
    columns: {
      name:      { col: "name",           type: "text" },
      amount:    { col: "amount",         type: "decimal" },
      months:    { col: "support_months", type: "int" },
      notes:     { col: "notes",          type: "text" },
      isSample:  { col: "is_sample",      type: "bit" },
      createdAt: { col: "created_at",     type: "datetime" },
    },
  },

  subsidy_applications: {
    table: "subsidy_applications",
    columns: {
      employeeId:    { col: "employee_id",    type: "text" },
      employeeName:  { col: "employee_name",  type: "text" },
      programId:     { col: "program_id",     type: "text" },
      program:       { col: "program_name",   type: "text" },
      status:        { col: "status",         type: "text" },
      paymentType:   { col: "payment_type",   type: "text" },
      monthsCount:   { col: "months_count",   type: "int" },
      monthlyAmount: { col: "monthly_amount", type: "decimal" },
      periodStart:   { col: "period_start",   type: "date" },
      periodEnd:     { col: "period_end",     type: "date" },
      totalAmount:   { col: "total_amount",   type: "decimal" },
      notes:         { col: "notes",          type: "text" },
      isSample:      { col: "is_sample",      type: "bit" },
      createdAt:     { col: "created_at",     type: "datetime" },
    },
    children: {
      months: {
        table: "subsidy_application_months",
        parentCol: "application_id",
        columns: {
          ym:        { col: "ym",        type: "text" },
          item:      { col: "item",      type: "text" },
          submitted: { col: "submitted", type: "bit" },
          amount:    { col: "amount",    type: "decimal" },
        },
      },
    },
  },

  projects: {
    table: "projects",
    columns: {
      name:      { col: "name",       type: "text" },
      isSample:  { col: "is_sample",  type: "bit" },
      createdAt: { col: "created_at", type: "datetime" },
    },
  },
};

/** /api/:collection 으로 허용되는 경로 목록 */
export const COLLECTION_PATHS = Object.keys(COLLECTIONS);

/** 앱 설정 단일 행 매핑 (schema.js 의 SETTINGS_DOC) */
export const SETTINGS = {
  table: "app_settings",
  columns: {
    adminPassword:    { col: "admin_password",         type: "text" },
    pmoPassword:      { col: "pmo_password",           type: "text" },
    visibleDivisions: { col: "visible_divisions_json", type: "json" },
    alertDays:        { col: "alert_days_json",        type: "json" },
  },
};

/* ---------------------------------------------------------
   중첩 경로 헬퍼 — "probation.startDate" 같은 점 표기를 읽고 쓴다
   --------------------------------------------------------- */

export function getPath(obj, path) {
  if (!path.includes(".")) return obj ? obj[path] : undefined;
  return path.split(".").reduce((cur, part) => (cur == null ? undefined : cur[part]), obj);
}

export function setPath(obj, path, value) {
  if (!path.includes(".")) {
    obj[path] = value;
    return;
  }
  const parts = path.split(".");
  const last = parts.pop();
  let cur = obj;
  for (const part of parts) {
    if (cur[part] == null || typeof cur[part] !== "object") cur[part] = {};
    cur = cur[part];
  }
  cur[last] = value;
}

/**
 * 중첩 경로를 쓰는 컬렉션에서, 값이 하나도 없어도 빈 객체를 만들어 둔다.
 * (화면이 `emp.probation || {}` 처럼 쓰므로 모양을 일정하게 유지)
 */
export function ensureNestedRoots(record, def) {
  const roots = new Set();
  Object.keys(def.columns || {}).forEach((f) => {
    if (f.includes(".")) roots.add(f.split(".")[0]);
  });
  Object.keys(def.children || {}).forEach((f) => {
    if (f.includes(".")) roots.add(f.split(".")[0]);
  });
  roots.forEach((r) => {
    if (record[r] == null || typeof record[r] !== "object") record[r] = {};
  });
}
