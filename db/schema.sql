/* =========================================================
   mcb-hr-ops — Azure SQL 스키마
   ---------------------------------------------------------
   설계 기준은 src/data/schema.js 의 COLLECTIONS 정의다.
   화면 코드는 한 줄도 바꾸지 않으므로, 이 스키마는 어댑터가
   주고받는 "문서" 를 관계형으로 펼친 결과다.

   원칙 세 가지
     1) 조회·집계에 쓰이는 스칼라 필드는 전부 실제 컬럼으로 둔다.
        (Power BI · 직접 쿼리 · 향후 서버측 필터를 위해)
     2) 모양이 자유롭고 통째로만 읽고 쓰는 중첩 문서는 JSON 컬럼.
        (resume, current_tasks, 평가 항목 items)
     3) 반복되고 집계의 원천이 되는 배열은 자식 테이블.
        (수습 평가 이력, 지원금 월별 내역)

   참조 무결성 방침
     - 소유 관계(직원 -> 계약/평가/지원금신청, 신청 -> 월별내역)는
       FK + ON DELETE CASCADE. 화면의 "샘플 데이터 정리" 가 직원을
       먼저 지우므로 CASCADE 가 없으면 FK 위반으로 실패한다.
     - 조회용 참조(program_id, project_id, leave_program_id)는 FK 를
       걸지 않는다. 화면이 미선택 시 빈 문자열을 보내고, 마스터가
       지워져도 이력은 남아야 하기 때문이다. 인덱스만 둔다.

   실행: db/apply-schema.mjs 또는 Azure Portal 쿼리 편집기.
         여러 번 실행해도 안전하다(존재하면 건너뛴다).
   ========================================================= */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------
   1) 지원금 마스터 — 다른 테이블이 참조하므로 먼저 만든다
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.subsidy_programs', 'U') IS NULL
CREATE TABLE dbo.subsidy_programs (
  id             NVARCHAR(50)   NOT NULL CONSTRAINT PK_subsidy_programs PRIMARY KEY,
  seq            BIGINT         IDENTITY(1,1) NOT NULL,  -- 입력 순서 보존(어댑터 load() 정렬 기준)
  name           NVARCHAR(200)  NOT NULL,
  amount         DECIMAL(14,2)  NULL,                    -- 단위: 만원
  support_months INT            NULL,                    -- schema.js 의 months (지원 개월수)
  notes          NVARCHAR(MAX)  NULL,
  is_sample      BIT            NOT NULL CONSTRAINT DF_subsidy_programs_is_sample DEFAULT (0),
  created_at     DATETIME2(3)   NOT NULL CONSTRAINT DF_subsidy_programs_created_at DEFAULT SYSUTCDATETIME(),
  updated_at     DATETIME2(3)   NOT NULL CONSTRAINT DF_subsidy_programs_updated_at DEFAULT SYSUTCDATETIME()
);
GO

/* ---------------------------------------------------------
   2) 프로젝트
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.projects', 'U') IS NULL
CREATE TABLE dbo.projects (
  id         NVARCHAR(50)  NOT NULL CONSTRAINT PK_projects PRIMARY KEY,
  seq        BIGINT        IDENTITY(1,1) NOT NULL,
  name       NVARCHAR(300) NULL,
  is_sample  BIT           NOT NULL CONSTRAINT DF_projects_is_sample DEFAULT (0),
  created_at DATETIME2(3)  NOT NULL CONSTRAINT DF_projects_created_at DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3)  NOT NULL CONSTRAINT DF_projects_updated_at DEFAULT SYSUTCDATETIME()
);
GO

/* ---------------------------------------------------------
   3) 직원 (인력 마스터) — 나머지 거의 전부가 이 테이블을 참조
   ---------------------------------------------------------
   probation 은 중첩 객체지만 스칼라 부분(시작/종료/판정)이
   "수습 평가 대상자" 집계의 기준이라 컬럼으로 펼쳤다.
   반복되는 probation.evaluations[] 만 자식 테이블로 뺀다.
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.employees', 'U') IS NULL
CREATE TABLE dbo.employees (
  id                            NVARCHAR(50)  NOT NULL CONSTRAINT PK_employees PRIMARY KEY,
  seq                           BIGINT        IDENTITY(1,1) NOT NULL,
  name                          NVARCHAR(100) NOT NULL,
  emp_no                        NVARCHAR(50)  NULL,
  division                      NVARCHAR(50)  NULL,   -- 역할별 노출범위(visibleDivisions) 필터 기준
  position                      NVARCHAR(50)  NULL,
  employment_type               NVARCHAR(50)  NULL,
  status                        NVARCHAR(20)  NULL,   -- 수습 / 근무 / 퇴사
  work_type                     NVARCHAR(50)  NULL,   -- 일반근무 외 값이면 휴가자 관리에 잡힘
  leave_start_date              DATE          NULL,
  leave_expected_return_date    DATE          NULL,
  leave_program_id              NVARCHAR(50)  NULL,   -- soft ref -> subsidy_programs (상단 방침 참고)
  recruit_type                  NVARCHAR(50)  NULL,
  location                      NVARCHAR(50)  NULL,
  birth_date                    DATE          NULL,
  hire_date                     DATE          NULL,
  work_start_date               DATE          NULL,
  phone                         NVARCHAR(50)  NULL,
  email                         NVARCHAR(200) NULL,
  current_salary                DECIMAL(14,2) NULL,   -- 단위: 만원
  last_contract_date            DATE          NULL,   -- 계약 갱신 대상 판정(만 1년) 기준
  subsidy_eligible              NVARCHAR(20)  NULL,   -- 아니오 / 대기 / 진행중 / 완료

  -- probation (중첩 객체의 스칼라 부분)
  probation_start_date          DATE          NULL,
  probation_end_date            DATE          NULL,
  probation_final_decision      NVARCHAR(20)  NULL,   -- 대기 / 합격 / 불합격 / 연장
  probation_final_decision_date DATE          NULL,
  probation_final_comment       NVARCHAR(MAX) NULL,

  -- 모양이 자유로운 중첩 문서 (통째로 읽고 쓴다)
  resume_json                   NVARCHAR(MAX) NULL CONSTRAINT CK_employees_resume_json CHECK (resume_json IS NULL OR ISJSON(resume_json) = 1),
  current_tasks_json            NVARCHAR(MAX) NULL CONSTRAINT CK_employees_tasks_json  CHECK (current_tasks_json IS NULL OR ISJSON(current_tasks_json) = 1),

  is_sample                     BIT           NOT NULL CONSTRAINT DF_employees_is_sample DEFAULT (0),
  created_at                    DATETIME2(3)  NOT NULL CONSTRAINT DF_employees_created_at DEFAULT SYSUTCDATETIME(),
  updated_at                    DATETIME2(3)  NOT NULL CONSTRAINT DF_employees_updated_at DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_employees_division' AND object_id = OBJECT_ID('dbo.employees'))
  CREATE INDEX IX_employees_division ON dbo.employees (division) INCLUDE (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_employees_status' AND object_id = OBJECT_ID('dbo.employees'))
  CREATE INDEX IX_employees_status ON dbo.employees (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_employees_probation_end' AND object_id = OBJECT_ID('dbo.employees'))
  CREATE INDEX IX_employees_probation_end ON dbo.employees (probation_end_date) WHERE probation_end_date IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_employees_is_sample' AND object_id = OBJECT_ID('dbo.employees'))
  CREATE INDEX IX_employees_is_sample ON dbo.employees (is_sample) WHERE is_sample = 1;
GO

/* ---------------------------------------------------------
   4) 수습 평가 이력 — employees.probation.evaluations[]
   ---------------------------------------------------------
   원본 배열의 각 항목에는 id 가 없다. 서버가 발급하고 ord 로
   배열 순서를 보존한다(어댑터는 항상 배열 전체를 다시 보낸다).
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.probation_evaluations', 'U') IS NULL
CREATE TABLE dbo.probation_evaluations (
  id            NVARCHAR(50)  NOT NULL CONSTRAINT PK_probation_evaluations PRIMARY KEY,
  employee_id   NVARCHAR(50)  NOT NULL,
  ord           INT           NOT NULL CONSTRAINT DF_probation_evaluations_ord DEFAULT (0),
  eval_date     DATE          NULL,
  evaluator     NVARCHAR(100) NULL,
  grade         NVARCHAR(10)  NULL,   -- S / A / B / C / D
  score         DECIMAL(6,2)  NULL,   -- 0~100
  items_json    NVARCHAR(MAX) NULL CONSTRAINT CK_probation_evaluations_items CHECK (items_json IS NULL OR ISJSON(items_json) = 1),
  comment       NVARCHAR(MAX) NULL,
  final_opinion NVARCHAR(50)  NULL,   -- 정규직 전환 권고 / 수습 연장 권고 / 전환 불가
  CONSTRAINT FK_probation_evaluations_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_probation_evaluations_employee' AND object_id = OBJECT_ID('dbo.probation_evaluations'))
  CREATE INDEX IX_probation_evaluations_employee ON dbo.probation_evaluations (employee_id, ord);
GO

/* ---------------------------------------------------------
   5) 계약
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.contracts', 'U') IS NULL
CREATE TABLE dbo.contracts (
  id             NVARCHAR(50)  NOT NULL CONSTRAINT PK_contracts PRIMARY KEY,
  seq            BIGINT        IDENTITY(1,1) NOT NULL,
  employee_id    NVARCHAR(50)  NOT NULL,
  employee_name  NVARCHAR(100) NULL,   -- 비정규화(조회 편의). 원본은 employees.name
  contract_type  NVARCHAR(50)  NULL,
  start_date     DATE          NULL,
  end_date       DATE          NULL,   -- 만료 임박 집계 기준
  annual_salary  DECIMAL(14,2) NULL,   -- 단위: 만원
  signing_bonus  DECIMAL(14,2) NULL,
  recruiting_fee DECIMAL(14,2) NULL,
  change_reason  NVARCHAR(50)  NULL,
  signed_date    DATE          NULL,
  status         NVARCHAR(20)  NULL,   -- 대기 / 지연 / 완료
  renewal_status NVARCHAR(20)  NULL,
  is_sample      BIT           NOT NULL CONSTRAINT DF_contracts_is_sample DEFAULT (0),
  created_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_contracts_created_at DEFAULT SYSUTCDATETIME(),
  updated_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_contracts_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_contracts_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_contracts_employee' AND object_id = OBJECT_ID('dbo.contracts'))
  CREATE INDEX IX_contracts_employee ON dbo.contracts (employee_id, start_date DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_contracts_end_date' AND object_id = OBJECT_ID('dbo.contracts'))
  CREATE INDEX IX_contracts_end_date ON dbo.contracts (end_date) WHERE end_date IS NOT NULL;
GO

/* ---------------------------------------------------------
   6) 프로젝트 평가
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.project_evaluations', 'U') IS NULL
CREATE TABLE dbo.project_evaluations (
  id            NVARCHAR(50)  NOT NULL CONSTRAINT PK_project_evaluations PRIMARY KEY,
  seq           BIGINT        IDENTITY(1,1) NOT NULL,
  employee_id   NVARCHAR(50)  NOT NULL,
  employee_name NVARCHAR(100) NULL,
  project_id    NVARCHAR(50)  NULL,   -- soft ref -> projects (화면에서 빈 문자열이 올 수 있음)
  project_name  NVARCHAR(300) NULL,
  [role]        NVARCHAR(100) NULL,
  period        NVARCHAR(100) NULL,
  score         DECIMAL(6,2)  NULL,
  evaluator     NVARCHAR(100) NULL,
  eval_date     DATE          NULL,
  strengths     NVARCHAR(MAX) NULL,
  improvements  NVARCHAR(MAX) NULL,
  is_sample     BIT           NOT NULL CONSTRAINT DF_project_evaluations_is_sample DEFAULT (0),
  created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_project_evaluations_created_at DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_project_evaluations_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_project_evaluations_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_project_evaluations_employee' AND object_id = OBJECT_ID('dbo.project_evaluations'))
  CREATE INDEX IX_project_evaluations_employee ON dbo.project_evaluations (employee_id);
GO

/* ---------------------------------------------------------
   7) 연간 평가
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.annual_evaluations', 'U') IS NULL
CREATE TABLE dbo.annual_evaluations (
  id                NVARCHAR(50)  NOT NULL CONSTRAINT PK_annual_evaluations PRIMARY KEY,
  seq               BIGINT        IDENTITY(1,1) NOT NULL,
  employee_id       NVARCHAR(50)  NOT NULL,
  employee_name     NVARCHAR(100) NULL,
  eval_year         INT           NULL,   -- schema.js 의 year
  grade             NVARCHAR(10)  NULL,   -- S / A / B / C / D
  score             DECIMAL(6,2)  NULL,
  evaluator         NVARCHAR(100) NULL,
  items_json        NVARCHAR(MAX) NULL CONSTRAINT CK_annual_evaluations_items CHECK (items_json IS NULL OR ISJSON(items_json) = 1),
  eval_date         DATE          NULL,
  comment           NVARCHAR(MAX) NULL,
  promotion_opinion NVARCHAR(MAX) NULL,
  is_sample         BIT           NOT NULL CONSTRAINT DF_annual_evaluations_is_sample DEFAULT (0),
  created_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_annual_evaluations_created_at DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_annual_evaluations_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_annual_evaluations_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_annual_evaluations_employee' AND object_id = OBJECT_ID('dbo.annual_evaluations'))
  CREATE INDEX IX_annual_evaluations_employee ON dbo.annual_evaluations (employee_id, eval_year DESC);
GO

/* ---------------------------------------------------------
   8) 상시 평가 (무기명)
   ---------------------------------------------------------
   ★ 이 테이블에는 평가자 컬럼이 없다. 무기명이 이 컬렉션의
     핵심 규칙이므로, 스키마 차원에서 저장 자체를 불가능하게 둔다.
     평가자 컬럼을 추가하지 말 것.
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.regular_evaluations', 'U') IS NULL
CREATE TABLE dbo.regular_evaluations (
  id            NVARCHAR(50)  NOT NULL CONSTRAINT PK_regular_evaluations PRIMARY KEY,
  seq           BIGINT        IDENTITY(1,1) NOT NULL,
  employee_id   NVARCHAR(50)  NOT NULL,
  employee_name NVARCHAR(100) NULL,
  eval_date     DATE          NULL,
  grade         NVARCHAR(10)  NULL,
  items_json    NVARCHAR(MAX) NULL CONSTRAINT CK_regular_evaluations_items CHECK (items_json IS NULL OR ISJSON(items_json) = 1),
  comment       NVARCHAR(MAX) NULL,
  is_sample     BIT           NOT NULL CONSTRAINT DF_regular_evaluations_is_sample DEFAULT (0),
  created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_regular_evaluations_created_at DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_regular_evaluations_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_regular_evaluations_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_regular_evaluations_employee' AND object_id = OBJECT_ID('dbo.regular_evaluations'))
  CREATE INDEX IX_regular_evaluations_employee ON dbo.regular_evaluations (employee_id);
GO

/* ---------------------------------------------------------
   9) 지원금 신청
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.subsidy_applications', 'U') IS NULL
CREATE TABLE dbo.subsidy_applications (
  id             NVARCHAR(50)  NOT NULL CONSTRAINT PK_subsidy_applications PRIMARY KEY,
  seq            BIGINT        IDENTITY(1,1) NOT NULL,
  employee_id    NVARCHAR(50)  NOT NULL,
  employee_name  NVARCHAR(100) NULL,
  program_id     NVARCHAR(50)  NULL,   -- soft ref -> subsidy_programs
  program_name   NVARCHAR(200) NULL,   -- schema.js 의 program
  status         NVARCHAR(20)  NULL,   -- 대기 / 진행 / 완료 (직원 subsidy_eligible 과 동기화)
  payment_type   NVARCHAR(20)  NULL,   -- 월별 / 1회성
  months_count   INT           NULL,
  monthly_amount DECIMAL(14,2) NULL,
  period_start   DATE          NULL,
  period_end     DATE          NULL,
  total_amount   DECIMAL(14,2) NULL,
  notes          NVARCHAR(MAX) NULL,
  is_sample      BIT           NOT NULL CONSTRAINT DF_subsidy_applications_is_sample DEFAULT (0),
  created_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_subsidy_applications_created_at DEFAULT SYSUTCDATETIME(),
  updated_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_subsidy_applications_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_subsidy_applications_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_subsidy_applications_employee' AND object_id = OBJECT_ID('dbo.subsidy_applications'))
  CREATE INDEX IX_subsidy_applications_employee ON dbo.subsidy_applications (employee_id);
GO

/* ---------------------------------------------------------
   10) 지원금 월별 내역 — subsidy_applications.months[]
   ---------------------------------------------------------
   ★ submitted = 1 인 월의 amount 합이 "수령액" 의 유일한 원천이다.
     (docs/DATA-MAP.md 참고) 돈이 걸린 값이라 JSON 이 아니라
     실제 테이블로 두어 직접 집계·검증이 가능하게 한다.
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.subsidy_application_months', 'U') IS NULL
CREATE TABLE dbo.subsidy_application_months (
  id             NVARCHAR(50)  NOT NULL CONSTRAINT PK_subsidy_application_months PRIMARY KEY,
  application_id NVARCHAR(50)  NOT NULL,
  ord            INT           NOT NULL CONSTRAINT DF_subsidy_application_months_ord DEFAULT (0),
  ym             CHAR(7)       NULL,   -- 'YYYY-MM'
  item           NVARCHAR(200) NULL,
  submitted      BIT           NOT NULL CONSTRAINT DF_subsidy_application_months_submitted DEFAULT (0),
  amount         DECIMAL(14,2) NULL,   -- 단위: 만원
  CONSTRAINT FK_subsidy_application_months_app FOREIGN KEY (application_id)
    REFERENCES dbo.subsidy_applications (id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_subsidy_application_months_app' AND object_id = OBJECT_ID('dbo.subsidy_application_months'))
  CREATE INDEX IX_subsidy_application_months_app ON dbo.subsidy_application_months (application_id, ord);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_subsidy_application_months_ym' AND object_id = OBJECT_ID('dbo.subsidy_application_months'))
  CREATE INDEX IX_subsidy_application_months_ym ON dbo.subsidy_application_months (ym, submitted) INCLUDE (amount);
GO

/* ---------------------------------------------------------
   11) 앱 설정 — 단일 행 (schema.js 의 SETTINGS_DOC)
   --------------------------------------------------------- */
IF OBJECT_ID('dbo.app_settings', 'U') IS NULL
CREATE TABLE dbo.app_settings (
  id                     INT           NOT NULL CONSTRAINT PK_app_settings PRIMARY KEY
                                       CONSTRAINT CK_app_settings_single_row CHECK (id = 1),
  admin_password         NVARCHAR(200) NULL,
  pmo_password           NVARCHAR(200) NULL,
  visible_divisions_json NVARCHAR(MAX) NULL CONSTRAINT CK_app_settings_divisions CHECK (visible_divisions_json IS NULL OR ISJSON(visible_divisions_json) = 1),
  alert_days_json        NVARCHAR(MAX) NULL CONSTRAINT CK_app_settings_alert_days CHECK (alert_days_json IS NULL OR ISJSON(alert_days_json) = 1),
  updated_at             DATETIME2(3)  NOT NULL CONSTRAINT DF_app_settings_updated_at DEFAULT SYSUTCDATETIME()
);
GO
