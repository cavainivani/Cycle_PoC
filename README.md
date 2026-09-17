# 인재 라이프사이클 허브 (M. Cloud Bridge HR Ops)

인사 관리 시스템입니다. **Azure App Service 에 배포되어 Azure SQL 을 씁니다.**

- 운영 주소 — https://mcb-hr-management.mcloudbridge.co.kr
- 데이터는 Azure SQL 에 저장되고, 로그인해야 볼 수 있습니다.
- DB 없이 화면만 돌려보는 `local` 모드도 남아 있습니다 (아래 "빠른 시작" 참고).

---

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173
```

기본 데이터 소스는 **`rest`** 입니다(`.env.example` 참고). Azure SQL 에 붙으므로
`.env.local` 에 DB 접속 정보가 있어야 하고, 방화벽에 개발 PC IP 가 열려 있어야 합니다.

DB 없이 화면만 돌려보려면 `local` 모드를 쓰세요. localStorage 에 저장되고
예시 데이터 12명 분이 자동으로 채워집니다.

```bash
VITE_DATA_SOURCE=local npm run dev
```

로그인 암호의 **초기값**은 관리자·PMO 모두 `0000000000` 입니다. 시스템 설정 화면에서
바꾸면 그 뒤로는 바뀐 암호를 씁니다 (`rest` 모드에서는 scrypt 해시로 DB 에 저장됩니다).

---

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (수정하면 즉시 반영) |
| `npm run build` | `dist/` 에 배포용 정적 파일 생성 |
| `npm run preview` | 빌드 결과를 로컬에서 확인 (`:4173`) |
| `npm start` | Express 서버로 `dist/` 서빙 (`:8080`) — Azure 와 동일한 형태 |
| `npm run lint` | 문법·import 누락 검사 |
| `npm run smoke` | 헤드리스 브라우저로 **전 화면 순회 + 등록/저장/엑셀 다운로드 검사** |
| `npm run db:schema` | `db/schema.sql` 을 Azure SQL 에 적용 (멱등) |

`npm start` 와 `npm run db:schema` 는 `.env.local` 이 있으면 자동으로 읽습니다
(`--env-file-if-exists`). 비밀번호를 명령줄에 넣지 않아도 됩니다.

`npm run smoke` 는 서버가 떠 있어야 합니다. 기본값은 `:4173`(`npm run preview`)이고,
다른 주소를 보려면 `SMOKE_URL` 을, 암호를 바꿨으면 `SMOKE_PASSWORD` 를 줍니다.

```bash
npm run build && npm run preview           # 터미널 1
npm run smoke                              # 터미널 2

SMOKE_URL=http://localhost:8080 npm run smoke   # npm start 로 띄운 경우
```

확인하는 것: 로그인 → 8개 화면 순회 → 직원 상세 서랍 4개 탭 → 보고서 렌더 →
직원 등록 후 새로고침해도 남아 있는지 → 엑셀 다운로드. 콘솔 오류가 하나라도 있으면 실패합니다.

---

## 지금 상태

**되는 것**

- 8개 화면 전부 클릭 가능 — 대시보드 / 수습·계약·지원금·휴가자 관리 / 인력·지원금 마스터 / 시스템 설정
- 직원 상세 서랍 (기본정보·이력서·계약·수습평가)
- 등록·수정·삭제가 **Azure SQL 에 저장**됩니다. 여러 사람이 같은 데이터를 봅니다.
- 엑셀 업로드/다운로드, 인력 현황 보고서 PDF 저장, 메일 본문 생성
- **서버 인증** — 암호는 서버가 검사하고(scrypt 해시), 세션은 HttpOnly 쿠키입니다.
  로그인하지 않으면 `/api` 가 전부 401 입니다.
- **역할별 제한이 서버에서 강제됩니다** — 노출 사업부 범위, 화면별 쓰기 권한 모두
  화면뿐 아니라 API 에서도 막힙니다.

- **동시 편집 시 덮어쓰기를 막습니다** — 내가 화면을 연 뒤 다른 사람이 저장했으면
  409 로 거절하고 최신 내용을 다시 불러옵니다.

**아직 아닌 것**

- 계정이 역할 2개(관리자·PMO)뿐입니다. 개인별 계정·감사 로그가 없어 "누가 고쳤는지"
  가 남지 않습니다. 사내 계정을 쓰려면 Entra ID 연동이 자연스럽습니다.
- 충돌이 나면 입력하던 내용은 버려지고 다시 입력해야 합니다. 필드 단위로 자동
  병합하지는 않습니다.

---

## 폴더 구조

```
index.html                 화면 껍데기 (사이드바 · 슬롯만)
vite.config.js             빌드 설정

server/
  index.js                 Express — dist/ 서빙 + /api 마운트
  api.js                   /api 라우터 (인증 · CRUD · 설정)
  auth.js                  암호 해시 · 세션 쿠키 · 역할별 권한
  collections.js           ★ 문서 <-> 컬럼 매핑 (필드 추가 시 고칠 유일한 곳)
  repository.js            매핑만 보고 SQL 생성
  db.js                    연결 풀 · 타입 변환 · 재시도

db/
  schema.sql               테이블 DDL (멱등)
  apply-schema.mjs         스키마 적용 (npm run db:schema)

Dockerfile                 배포용 컨테이너 이미지 (멀티스테이지)
.dockerignore              빌드 컨텍스트 제외 목록
scripts/azure-deploy.sh    Azure App Service 배포 자동화

src/
  app.js                   기동 지점
  styles.css               전체 스타일
  vendor.js                엑셀/PDF 라이브러리 로더

  config/
    options.js             사업부·직급·고용형태 등 선택지 상수
    nav.js                 사이드바 메뉴 정의, PMO 차단 목록

  state/
    settings.js            노출 사업부 · 알림 기준일 · 로그인 세션
                           (암호는 여기 없다 — 서버만 안다)
    ui.js                  화면 상태 (열린 탭, 선택된 행 등)

  data/
    schema.js              ★ 컬렉션 · 필드 정의 (문서이자 코드)
    seed.js                예시 데이터
    store.js               ★ 화면과 저장소 사이의 유일한 통로
    settings-store.js      설정 저장/로드
    adapters/
      rest.js              REST 어댑터 — /api 사용 (★ 운영에서 쓰는 것)
      local.js             localStorage 어댑터 (DB 없이 돌려보는 초안 모드)

  core/
    router.js              화면 전환, 사이드바 렌더
    bindings.js            화면별 이벤트 연결
    format.js              날짜·금액 포맷, 기간 계산
    download.js            파일 다운로드
    bus.js                 데이터 변경 → 화면 갱신 중개

  domain/
    hr.js                  인사 규칙 (수습 판정, 계약 갱신 대상, 지원금 상태 동기화 등)
    employee-helpers.js    직원 관련 조회 헬퍼 (최신 계약, 최근 수습평가일)

  ui/
    icons.js, overlay.js   아이콘, 토스트·모달

  views/                   화면 하나당 파일 하나
  features/                엑셀 업로드/다운로드

docs/DATA-MAP.md           ★ 화면별로 어떤 데이터를 보는지 정리
```

**★ 표시 세 개가 "어떤 데이터를 바라보는지"의 핵심입니다.**
기능을 붙이기 전에 [`docs/DATA-MAP.md`](docs/DATA-MAP.md) 를 먼저 보세요.

---

## Azure App Service 배포

**Linux 컨테이너 방식**으로 배포합니다. Vite 빌드 결과를 Express 가 서빙하는
이미지를 만들어 ACR 에 올리고, App Service 가 그 이미지를 바라보게 합니다.

### 배포 대상

| 항목 | 값 |
|---|---|
| 구독 | `DataSolution(Dev)` (`8151e37b-7d16-4a46-8b6e-aa1cbb7e64dd`) |
| 리소스 그룹 | `MCB_IS_HR_Management_RG` (Korea Central) |
| Web App | `MCB-HR-Management` (Linux 컨테이너, **B1** 플랜) |
| 레지스트리 | `acrmcbhrops.azurecr.io` (Basic) |
| 이미지 | `acrmcbhrops.azurecr.io/mcb-hr-ops:<태그>` |
| DB | `mcb-hr-management.database.windows.net` / `MCB-HR-Management-DB` |
| 컨테이너 포트 | `8080` (앱 설정 `WEBSITES_PORT`) |

**앱·레지스트리·DB 가 전부 같은 구독**에 있습니다. 예전에는 이미지를 다른
테넌트(hnfriends)의 `acrhnfmcb` 에서 받아왔는데, 그 레지스트리는 다른 프로젝트
소유라 더는 쓰지 않습니다.

> 이미지 pull 은 **ACR 관리자 자격 증명**을 씁니다. 관리 ID 로 pull 하는 편이
> 깨끗하지만 `AcrPull` 역할 할당에 Owner / User Access Administrator 권한이
> 필요한데 현재 계정은 Contributor 입니다. 권한이 생기면 전환하세요.

### 1) 수동 배포

```bash
az login --tenant 033ad662-3b65-45f4-9052-5b0f8d949ff4
```

> 이 테넌트는 조건부 액세스(인증 컨텍스트)를 걸어 두어, Windows 계정 브로커로는
> 단계별 인증이 뜨지 않습니다. 막히면 `az config set core.enable_broker_on_windows=false`
> 로 브라우저 로그인을 쓰세요.

```bash
# 1. 이미지 빌드 (로컬 Docker 불필요 — ACR 에서 빌드)
az acr build -r acrmcbhrops -t mcb-hr-ops:v4 --platform linux/amd64 --no-logs .

# 2. App Service 에 연결 + 재시작
bash scripts/azure-deploy.sh v4
```

> **데이터 소스는 빌드 시점에 번들에 박힙니다.** `.dockerignore` 가 `.env.local` 을
> 제외하므로, Dockerfile 이 `ARG VITE_DATA_SOURCE=rest` 로 직접 값을 넘깁니다.
> 빌드 마지막 단계에서 번들을 검사해 값이 다르면 이미지 빌드가 실패합니다.
> localStorage 모드 이미지를 만들려면 `--build-arg VITE_DATA_SOURCE=local` 을 주세요.

`az acr build` 의 로그 스트리밍은 Windows cp949 콘솔에서 Vite 의 `✓` 문자 때문에
죽습니다(azure-cli 이슈). `--no-logs` 를 쓰고 상태는 아래로 확인하세요.

```bash
az acr task list-runs -r acrmcbhrops --top 3 -o table
```

> GitHub Actions 자동 배포는 두지 않았습니다. 대상 테넌트가 SCM 기본 인증을
> 막아 두어(게시 프로필 사용 불가) OIDC 연합 자격 증명이 필요한데, Entra 앱 등록과
> 역할 할당까지 얽혀 1인 개발 단계에서는 값어치보다 품이 큽니다. 필요해지면
> 그때 붙이면 됩니다.

### 2) 확인

```
https://mcb-hr-management.mcloudbridge.co.kr/healthz        # 서버 살아있는지
https://mcb-hr-management.mcloudbridge.co.kr/api/health/db  # DB 까지 왕복되는지
```

각각 `{"ok":true,...}` 가 나오면 정상입니다.

B1 플랜에 **Always On 이 켜져 있어** 유휴 상태에서도 컨테이너가 잠들지 않습니다.
DB 도 Basic(프로비저닝형)이라 자동 일시중지가 없습니다. 즉 콜드 스타트가 없습니다.

| 리소스 | 요금제 | 특징 |
|---|---|---|
| App Service | B1 (Basic) | Always On 지원, 커스텀 도메인 + SSL 가능 |
| Azure SQL | Basic 5 DTU / 2GB | 자동 일시중지 없음, 정액 |
| ACR | Basic | 이미지 보관 |

> 예전 문서에 있던 "F1 무료 플랜 · 50초 콜드 스타트 · CPU 하루 60분" 은 더는
> 해당하지 않습니다. DB 도 처음엔 서버리스 무료 혜택(60분 뒤 자동 일시중지,
> 월 한도 소진 시 정지)이었으나 Basic 으로 올렸습니다.

---

## 데이터베이스 (Azure SQL)

화면 코드는 **한 줄도 바뀌지 않았습니다.** `VITE_DATA_SOURCE` 한 줄로 저장소가 갈립니다.

| 리소스 | 값 |
|---|---|
| 서버 | `mcb-hr-management.database.windows.net` |
| DB | `MCB-HR-Management-DB` (GP_S_Gen5 서버리스, 32GB) |
| 자동 일시중지 | **60분** — 유휴 시 정지, 첫 요청에 재개 지연이 붙습니다 |

### 구성 파일

| 파일 | 하는 일 |
|---|---|
| `db/schema.sql` | 테이블 DDL (멱등 — 여러 번 실행해도 안전) |
| `db/apply-schema.mjs` | 위 DDL 을 적용하는 스크립트 (`npm run db:schema`) |
| `server/collections.js` | **문서 ↔ 컬럼 매핑 정의. 필드를 추가할 때 고치는 유일한 곳** |
| `server/repository.js` | 매핑만 보고 SQL 을 생성 (테이블별 손쓴 쿼리 없음) |
| `server/db.js` | 연결 풀 · 타입 변환 · 재시도 |
| `server/api.js` | `/api` 라우터 |

### 테이블

`src/data/schema.js` 의 8개 컬렉션을 11개 테이블로 펼쳤습니다.

| 테이블 | 대응 컬렉션 | 비고 |
|---|---|---|
| `employees` | `employees` | `probation` 스칼라는 컬럼으로 펼침, `resume`·`currentTasks` 는 JSON |
| `probation_evaluations` | `employees.probation.evaluations[]` | 배열 순서를 `ord` 로 보존 |
| `contracts` | `contracts` | |
| `project_evaluations` | `project_evaluations` | |
| `annual_evaluations` | `annual_evaluations` | `items[]` 는 JSON |
| `regular_evaluations` | `regular_evaluations` | **평가자 컬럼 없음 (무기명)** |
| `subsidy_programs` | `subsidy_programs` | |
| `subsidy_applications` | `subsidy_applications` | |
| `subsidy_application_months` | `subsidy_applications.months[]` | 수령액 집계의 원천이라 실제 테이블 |
| `projects` | `projects` | |
| `app_settings` | `app_settings/system` | 단일 행 |

설계 기준 세 가지 — 조회·집계에 쓰이는 스칼라는 **실제 컬럼**, 모양이 자유로운 중첩 문서는
**JSON 컬럼**, 반복되며 집계 원천이 되는 배열은 **자식 테이블**. 자세한 근거는
`db/schema.sql` 상단 주석에 있습니다.

### 스키마 적용

```bash
# 개발 PC 에서 (방화벽에 내 IP 가 열려 있어야 함)
SQL_AUTH=sql SQL_USER=mcbsqladmin SQL_PASSWORD='...' npm run db:schema
```

### API

`src/data/adapters/rest.js` 의 계약을 그대로 구현합니다.

```
GET    /api/collections        -> { employees:[...], contracts:[...], ... }
POST   /api/:collection        -> 201 { id }
PUT    /api/:collection/:id    -> 204
PATCH  /api/:collection/:id    -> 204
DELETE /api/:collection/:id    -> 204
GET    /api/settings           -> 설정 문서 또는 null
PUT    /api/settings           -> 204
GET    /api/health/db          -> DB 왕복 확인 (계약 외 · 서버리스 깨우기용)
```

`PUT` 과 `PATCH` 는 서버에서 같은 연산입니다. 화면의 `store.js` 가 `deepMerge` 로 병합을
끝낸 **레코드 전체**를 보내기 때문에, 서버가 부분 갱신을 따로 처리할 이유가 없습니다.

### 동시 편집 (낙관적 동시성 제어)

레코드 전체를 보내는 구조에는 함정이 있습니다. 두 사람이 같은 직원을 열어 각자
다른 필드를 고치면, 나중에 저장한 쪽이 **자기 사본의 옛 값까지 함께 써 넣어**
앞사람의 수정을 조용히 덮습니다. 서버는 "바꾸려던 값" 과 "안 건드린 값" 을 구분할
수 없습니다 — 둘 다 똑같이 생겼기 때문입니다.

그래서 값 대신 **"내가 읽은 뒤로 이 행이 바뀌었는가"** 를 확인합니다.

```
GET  /api/collections          -> 레코드마다 _version 이 실려 온다
PATCH /api/:collection/:id     -> 그 _version 을 그대로 돌려보낸다
     서버: UPDATE ... WHERE id = @id AND row_version = @version
           0행이면 -> 409 (그 사이 누가 저장했다)
```

`_version` 은 SQL Server 의 `ROWVERSION` 으로, 행이 바뀔 때마다 DB 가 자동으로
올립니다. 화면은 이 값을 읽지 않고 받은 그대로 되돌려 보내기만 합니다.

409 를 받으면 `store.js` 가 최신 내용을 다시 불러오고 사용자에게 알립니다.
입력하던 값은 버려집니다 — 조용히 남의 수정을 덮는 것보다 다시 입력하는 편이 낫습니다.

> **`_version` 을 빼고 보내면 409 입니다.** 허용하면 보호가 있으나 마나 해집니다
> (필드 하나만 빼면 우회되므로). 새로 만들 때(`POST`)는 필요 없습니다.

---

## 인증과 권한

암호 검사는 **서버가** 합니다(`server/auth.js`). 브라우저는 암호 정답을 가지지 않습니다.

```
POST /api/login     {role, password}  ->  200 {role} + 세션 쿠키
POST /api/logout                      ->  204
GET  /api/session                     ->  {role} 또는 null
POST /api/password  {role, newPassword} -> 204  (관리자만)
```

| 항목 | 방식 |
|---|---|
| 암호 저장 | scrypt 해시 (`app_settings` 테이블) — Node 내장 crypto, 외부 의존성 없음 |
| 세션 | HMAC 서명한 무상태 쿠키. HttpOnly + SameSite, 기본 12시간 |
| 공개 엔드포인트 | `/login`, `/logout`, `/session`, `/health/db` **뿐** |

> `SESSION_SECRET` 을 App Service 앱 설정에 넣어 둡니다. 이 값이 바뀌면 전원 로그아웃됩니다.
> 값이 없으면 서버가 임시 키를 만들고 경고를 남깁니다(재시작마다 로그아웃).

### 세 겹으로 막습니다

화면에도 같은 제한이 있지만 그건 표시용입니다. API 를 직접 불러도 뚫리지 않게 하는 것은
서버뿐입니다. 검사 순서는 **권한 → 범위 → 본문** 입니다.

| 겹 | 막는 것 | 거부 응답 |
|---|---|---|
| 1. 인증 | 로그인 안 하면 `/api` 전부 | `401` |
| 2. 쓰기 권한 | 역할이 접근할 수 없는 화면의 컬렉션 (`WRITE_PERMISSIONS`) | `403` |
| 3. 사업부 범위 | 노출 범위를 벗어난 레코드 | `404` (기존 레코드) / `403` (신규) |

범위 밖 레코드에 `403` 이 아니라 `404` 를 주는 것은 의도한 것입니다. 둘을 나누면
"그 id 는 존재한다" 는 사실이 새기 때문입니다.

역할별 쓰기 권한(`server/auth.js` 의 `WRITE_PERMISSIONS`):

| 역할 | 쓰기 가능 |
|---|---|
| `admin` | 제한 없음 |
| `pmo` | `employees` 의 `PUT`/`PATCH` 만 — 휴가자 관리의 직원 정보 수정 |

PMO 가 도달할 수 있는 화면은 대시보드·수습 관리·계약 관리·휴가자 관리뿐이고
(`PMO_RESTRICTED_ROUTES`), 그중 쓰기는 휴가 정보 수정 하나입니다. 화면에서 못 하는 일은
API 로도 못 하게 맞춰 둔 것입니다.

> 화면 쪽 접근 제한은 `setRoute()` 와 **`renderRoute()` 양쪽**에 있습니다. `route` 가
> 모듈 변수라 로그아웃해도 남기 때문에, 그리기 직전에도 검사해야 다른 역할로 다시
> 로그인했을 때 이전 화면이 남지 않습니다.

---

## 이어서 할 일

**판단이 필요한 항목**들입니다.

1. **평가 기능 전체가 화면에서 도달 불가능합니다.** (원본 초안부터 그랬고, 재구성 중 건드리지 않았습니다)

   프로젝트 평가 / 연간 평가 / 상시 평가는 등록 모달까지 전부 구현되어 있고 코드 자체는
   정상 동작하는데, **들어가는 문이 두 곳 다 막혀 있습니다.**

   | 경로 | 막힌 이유 |
   |---|---|
   | 사이드바 → 평가 관리 | `NAV_GROUPS`(`src/config/nav.js`)에 `evaluations` 항목이 없음 |
   | 직원 상세 서랍 → 평가 탭 | `DRAWER_TABS`에 `projectEval`/`annualEval`/`regularEval` 탭이 없음 (렌더러는 존재) |

   결과적으로 평가 등록 버튼(`data-add-projeval` 등)이 화면에 그려지지 않아 모달도 열리지
   않습니다. 확인 결과 화면 자체는 멀쩡합니다 — 임시로 라우트를 태워 보니 세 탭 모두
   데이터와 함께 정상 렌더됩니다.
   → **메뉴에 넣을지 / 서랍 탭으로 넣을지 결정만 하면 되는 상태**입니다. (한 줄씩이면 됩니다)

2. **충돌 시 입력값이 버려집니다.**
   덮어쓰기는 막았지만(위 "동시 편집" 참고), 409 가 나면 사용자가 입력하던 내용은
   사라지고 다시 입력해야 합니다. 바뀐 필드끼리 자동 병합하거나, 무엇이 달라졌는지
   보여주고 고르게 하려면 화면 작업이 더 필요합니다.

3. **"만료 30일" 기준이 코드 5곳에 박혀 있습니다.**
   시스템 설정의 알림 기준일(수습/계약)과 **별개로** 동작합니다.

   - `src/views/dashboard.js:15` — 계약 만료 임박 집계
   - `src/views/hr-report.js:17` — 보고서의 동일 집계
   - `src/views/employees.js:44` — 인력 마스터 빠른 필터
   - `src/views/evaluations.js:14,19` — 평가 화면 필터

   설정값으로 뺄지 확인이 필요합니다.

4. **계정이 역할 2개뿐입니다.**
   관리자·PMO 공용 암호라 "누가 고쳤는지" 가 남지 않습니다. 개인별 계정과 감사 로그가
   필요해지면 Entra ID(Azure AD) 연동이 자연스럽습니다. 지금 구조는 서버 인증 +
   세션 쿠키라, 로그인 부분만 바꾸면 나머지는 그대로 쓸 수 있습니다.

5. **관리 ID 로 ACR pull 전환.**
   지금은 ACR 관리자 자격 증명(비밀번호)을 App Service 설정에 넣어 씁니다.
   `AcrPull` 역할 할당에 Owner / User Access Administrator 권한이 필요한데 현재 계정은
   Contributor 라 못 했습니다. 권한이 생기면 비밀번호를 없앨 수 있습니다.

---

## 참고

- `_legacy-artifact.html` — 재구성 전 원본 초안 (단일 HTML). 비교용으로 남겨 두었습니다.
