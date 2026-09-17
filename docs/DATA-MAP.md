# 화면 ↔ 데이터 맵

각 화면이 **어떤 데이터를 읽고 무엇을 쓰는지**를 한 장에 정리한 문서입니다.
기능을 하나씩 붙일 때 "이 화면을 건드리면 어디까지 영향이 가는가"를 먼저 여기서 확인하세요.

- 필드 단위 정의: [`src/data/schema.js`](../src/data/schema.js)
- 저장/조회 통로: [`src/data/store.js`](../src/data/store.js)
- 예시 데이터: [`src/data/seed.js`](../src/data/seed.js)

---

## 1. 데이터가 흐르는 길

```
Azure SQL  ← 서버가 역할에 맞게 이미 걸러서 내려준다
        │
어댑터(REST · 운영 / localStorage · 초안 모드)
        │  load()
        ▼
   rawState          ← 저장소에서 받은 그대로
        │  applyDivisionScope()   ← 화면용 한 번 더 (표시 목적)
        ▼
     state           ← 로그인한 역할의 "노출 사업부" 범위로 걸러진 뷰
        │
        ▼
   화면(views/*)     ← 화면 코드는 오직 state 만 읽는다
        │  dbAdd / dbUpdate / dbDelete
        ▼
   store.mutate() → 어댑터 저장 → reloadAll() → 화면 다시 그리기
```

핵심 규칙 두 가지입니다.

1. **화면은 `state` 만 읽는다.** `rawState` 를 직접 읽는 화면이 생기면 사업부 권한 분리가 뚫립니다.
2. **저장은 반드시 `dbAdd/dbUpdate/dbDelete` 를 거친다.** 어댑터를 직접 부르면 화면 갱신이 일어나지 않습니다.

---

## 2. 컬렉션 한눈에 보기

| 컬렉션 경로 (저장소) | `state` 이름 | 한국어 이름 | 주요 참조 |
|---|---|---|---|
| `employees` | `state.employees` | 직원 (인력 마스터) | 모든 화면의 기준 |
| `contracts` | `state.contracts` | 계약 | → `employees` |
| `project_evaluations` | `state.projectEvals` | 프로젝트 평가 | → `employees`, `projects` |
| `annual_evaluations` | `state.annualEvals` | 연간 평가 | → `employees` |
| `regular_evaluations` | `state.regularEvals` | 상시 평가 (무기명) | → `employees` |
| `subsidy_programs` | `state.subsidyPrograms` | 지원금 마스터 | — |
| `subsidy_applications` | `state.subsidyApps` | 지원금 신청 | → `employees`, `subsidy_programs` |
| `projects` | `state.projects` | 프로젝트 | — |

설정값은 컬렉션이 아니라 **단일 설정 문서**(`app_settings/system`)에 저장됩니다.
→ 역할별 노출 사업부, 알림 기준일. `src/data/settings-store.js` 참고.

암호는 같은 `app_settings` 행에 있지만 **이 문서에 실려 오지 않습니다.** 서버가
scrypt 해시로 보관하고 검사하며(`POST /api/login`), 변경도 별도 경로
(`POST /api/password`)를 씁니다. `GET /api/settings` 응답에 암호를 넣으면 안 됩니다.

---

## 3. 화면별 상세

### 대시보드 — `src/views/dashboard.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.employees`, `state.contracts`, `state.subsidyApps` |
| 쓰기 | 없음 (조회 전용) |
| 계산 로직 | `contractRenewalDueList()`, `probationStatusOf()`, `contractEffectiveStatus()` |

집계 기준:
- **재직 인원** = `status !== "퇴사"`
- **수습 평가 대상자** = 수습 종료일이 `settings.alertDays.probation`(기본 30일) 이내
- **계약 갱신 대상** = 최종 계약일 기준 만 1년 시점이 `settings.alertDays.contract` 이내이거나 이미 지난 경우
- **계약 만료 임박** = `contracts.endDate` 가 30일 이내
  (이 30은 설정값이 아니라 코드에 고정 — `dashboard.js:15`, `hr-report.js:17`, `employees.js:44`, `evaluations.js:14,19` 총 5곳)
- **올해 지원금 수금액** = `subsidyApps[].months[]` 중 `submitted === true` 인 월의 `amount` 합

---

### 인력 마스터 — `src/views/employees.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.employees`, `state.contracts`, `state.annualEvals`, `state.subsidyPrograms` |
| 쓰기 | `employees` (신규 등록) |
| 엑셀 | `src/features/excel-employees.js` (직원 + 계약 시트 동시 업로드) |

- 필터 상태는 `empFilters` (모듈 지역 변수), 열려 있는 드롭다운은 `ui.openFilterDropdown`.
- `state.subsidyPrograms` 는 근무형태 "기타" 선택 시 연계할 지원금 항목 목록에만 쓰입니다.

---

### 직원 상세 서랍 — `src/views/employee-drawer.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.employees`, `state.contracts`, `state.projectEvals`, `state.annualEvals`, `state.regularEvals`, `state.projects` |
| 쓰기 | `employees`(update), `contracts`, `project_evaluations`, `annual_evaluations`, `regular_evaluations` |
| 탭 | `profile` / `resume` / `contracts` / `probation` (`DRAWER_TABS`) |

- 이력서(`resume`)·현재 업무(`currentTasks`)·수습 정보(`probation`)는 **직원 레코드 안의 중첩 필드**입니다. 별도 컬렉션이 아닙니다.
- 계약을 "갱신" 모달로 등록하면 직원의 `currentSalary` / `lastContractDate` 도 함께 갱신됩니다.
- 수습 최종 판정이 "합격"이면 직원 `status` 가 자동으로 `"근무"` 로 바뀝니다.

---

### 수습 관리 — `src/views/probation.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.employees` (중첩 `probation` 필드) |
| 쓰기 | 없음 (등록·수정은 직원 상세 서랍에서) |

대상자 판정: `probationEvalTargets()` — 수습 종료일까지 남은 일수가 `settings.alertDays.probation` 이내이고 최종 판정이 아직 "대기"인 인원.

---

### 계약 관리 — `src/views/contracts.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.contracts` |
| 쓰기 | 없음 (등록은 직원 상세 서랍에서) |

"대기 리스트" = `contractRenewalDueList()` — 최종 계약일 기준 만 1년 시점이 `settings.alertDays.contract` 이내이거나 이미 지난 직원.

---

### 지원금 관리 — `src/views/subsidy.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.subsidyApps`, `state.employees`, `state.subsidyPrograms` |
| 쓰기 | `subsidy_applications` (add/update), 그리고 **직원의 `subsidyEligible` 자동 동기화** |

`syncEmployeeSubsidyStatus()` 가 신청 상태(대기/진행/완료)를 직원 필드(대기/진행중/완료)로 옮겨 적습니다.
한 직원에게 신청이 여러 건이면 `SUBSIDY_EMP_STATUS_RANK` 기준으로 **가장 진행된 상태**가 반영됩니다.

수령액 집계는 `months[]` 배열의 `submitted` 플래그가 원천입니다.

---

### 지원금 마스터 — `src/views/subsidy-programs.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.subsidyPrograms` |
| 쓰기 | `subsidy_programs` (add), 상세 화면에서 update/delete |
| 엑셀 | `src/features/excel-subsidy.js` |

---

### 휴가자 관리 — `src/views/leave.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.employees`, `state.subsidyPrograms` |
| 쓰기 | `employees` (update — 휴가 기간·연계 지원금 항목) |

대상: `isOnLeave(e)` — `workType` 이 출산휴가 / 육아단축근무 / 기타 인 재직 인원.

---

### 평가 관리 — `src/views/evaluations.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `state.projectEvals`, `state.annualEvals`, `state.regularEvals`, `state.employees`, `state.contracts` |
| 쓰기 | 없음 (등록은 서랍의 모달을 통해) |

> ⚠️ **이 화면은 현재 UI에서 도달할 수 없습니다.** 코드는 정상 동작하지만 들어가는 문이 두 곳 다 막혀 있습니다.
> - 사이드바: `NAV_GROUPS`(`src/config/nav.js`)에 `evaluations` 항목 없음
> - 직원 상세 서랍: `DRAWER_TABS`에 `projectEval`/`annualEval`/`regularEval` 탭 없음 (렌더러는 존재)
>
> 자세한 내용은 README 의 "이어서 할 일" 참고.

---

### 시스템 설정 — `src/views/system-settings.js`
| 구분 | 내용 |
|---|---|
| 읽기 | `settings.*` (컬렉션이 아닌 설정 문서) |
| 쓰기 | `setSystemPassword()`, `setVisibleDivisions()`, `setAlertDays()` |

역할별 노출 사업부를 바꾸면 `applyDivisionScope()` 가 다시 돌면서 **모든 화면의 `state` 가 한 번에** 좁혀집니다.

---

### 인력 현황 보고서 — `src/views/hr-report.js`
| 구분 | 내용 |
|---|---|
| 읽기 | 대시보드와 동일 (`hrReportData()`) |
| 쓰기 | 없음 |
| 출력 | 화면 인쇄 / PDF 다운로드 / 메일 본문 텍스트 생성 |

---

## 4. 권한 (역할)

| 역할 | 접근 가능 화면 |
|---|---|
| `admin` (관리자) | 전부 |
| `pmo` | 대시보드, 수습 관리, 계약 관리, 휴가자 관리 |

PMO 차단 목록은 `PMO_RESTRICTED_ROUTES` (`src/config/nav.js`). 메뉴에서 숨기는 것,
`setRoute()` 에서 막는 것, `renderRoute()` 에서 그리기 직전에 막는 것 — **세 군데 모두**
이 상수를 봅니다.

> `renderRoute()` 의 검사를 빼면 안 됩니다. `route` 는 모듈 변수라 로그아웃해도 남고,
> 로그인 직후 경로는 `setRoute()` 를 거치지 않습니다. 관리자가 시스템 설정을 보던
> 상태에서 PMO 로 바꿔 로그인하면 그 화면이 그대로 남았던 적이 있습니다.

### 화면의 제한은 표시용입니다

**진짜 경계는 서버에 있습니다.** 화면 코드를 우회해 `/api` 를 직접 불러도 뚫리지
않도록, 같은 제한이 서버에도 있습니다 (`server/auth.js`, `server/api.js`).

| 겹 | 막는 것 | 거부 |
|---|---|---|
| 인증 | 로그인 없이는 `/api` 전부 | `401` |
| 쓰기 권한 | 역할이 접근할 수 없는 화면의 컬렉션 | `403` |
| 사업부 범위 | `applyDivisionScope()` 와 같은 규칙을 서버가 다시 적용 | `404` / `403` |
| 동시 편집 | 내가 읽은 뒤 남이 저장한 레코드 덮어쓰기 | `409` |

`dbUpdate` 가 보내는 레코드에는 `_version` 이 들어 있습니다. `load()` 로 받은 값이
`rawState` 에 남아 있다가 `deepMerge` 를 타고 그대로 돌아가는 구조라, 화면 코드는
이 값을 몰라도 됩니다. **다만 레코드를 직접 만들어 `dbUpdate` 에 넘기면 안 됩니다**
— `_version` 이 빠져 409 가 납니다. 항상 `state` 에서 읽은 것을 기반으로 고치세요.

`applyDivisionScope()` 의 규칙을 고치면 `server/repository.js` 의 `scopeFor()` /
`loadAll()` 도 같이 고쳐야 합니다. 두 곳이 어긋나면 화면과 API 가 다른 데이터를 봅니다.

암호는 서버가 scrypt 해시로 보관하며 브라우저로 나가지 않습니다. `settings` 객체에
암호 필드가 없는 것은 그래서입니다.

---

## 5. 기능을 하나 추가할 때

1. **어떤 데이터가 필요한가?** → `src/data/schema.js` 에서 기존 컬렉션·필드로 되는지 먼저 확인
2. 새 필드가 필요하면 → **세 곳을 같이** 고친다
   - `src/data/schema.js` — 필드 정의 (문서이자 코드)
   - `db/schema.sql` — 컬럼 추가 후 `npm run db:schema`
   - `server/collections.js` — 문서 ↔ 컬럼 매핑

   > ⚠️ `server/collections.js` 의 `columns` 는 **허용 목록**입니다. 여기 없는 키는
   > 저장되지 않고 조용히 버려집니다. 빠뜨리면 화면에서는 입력되는데 새로고침하면
   > 사라집니다. 개발 모드에서는 서버가 버려진 키를 콘솔에 경고로 남깁니다.

   `seed.js` 의 예시 데이터에도 값을 채우면 `local` 모드에서 바로 보입니다.
3. 화면 수정 → 해당 `src/views/*.js` 파일 하나만 건드린다
4. 저장이 필요하면 → `dbAdd/dbUpdate/dbDelete` 사용 (어댑터 직접 호출 금지)
5. 새 메뉴가 필요하면 → `src/config/nav.js` 의 `NAV_GROUPS` + `src/core/router.js` 의 `renderers` 맵
   - PMO 가 볼 수 없는 화면이면 `PMO_RESTRICTED_ROUTES` 에도 넣고,
     그 화면이 쓰는 컬렉션은 `server/auth.js` 의 `WRITE_PERMISSIONS` 로도 막는다
6. 확인 → `npm run lint` 로 import 누락을 잡고, `npm run smoke` 로 전 화면이 깨지지 않았는지 본다
