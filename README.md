# 인재 라이프사이클 허브 (M. Cloud Bridge HR Ops)

인사 관리 시스템 **개발 초안**입니다. DB 없이 브라우저만으로 전 화면을 클릭해 볼 수 있고,
그대로 Azure App Service 에 배포할 수 있습니다.

---

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173
```

로그인 암호는 **`0000000000`** (관리자/PMO 공통 초기값)입니다.

처음 열면 예시 데이터 12명 분이 자동으로 채워집니다. 상단 배너의 **"샘플 데이터 정리"** 로 전부 지울 수 있습니다.

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

`npm run smoke` 는 서버가 떠 있어야 합니다. 기본값은 `:4173`(`npm run preview`)이고,
다른 주소를 보려면 `SMOKE_URL` 을 줍니다.

```bash
npm run build && npm run preview           # 터미널 1
npm run smoke                              # 터미널 2

SMOKE_URL=http://localhost:8080 npm run smoke   # npm start 로 띄운 경우
```

확인하는 것: 로그인 → 8개 화면 순회 → 직원 상세 서랍 4개 탭 → 보고서 렌더 →
직원 등록 후 새로고침해도 남아 있는지 → 엑셀 다운로드. 콘솔 오류가 하나라도 있으면 실패합니다.

---

## 지금 이 초안의 상태

**되는 것**

- 8개 화면 전부 클릭 가능 — 대시보드 / 수습·계약·지원금·휴가자 관리 / 인력·지원금 마스터 / 시스템 설정
- 직원 상세 서랍 (기본정보·이력서·계약·수습평가)
- 등록·수정·삭제가 실제로 동작하고 **새로고침해도 유지됨** (브라우저 localStorage)
- 엑셀 업로드/다운로드, 인력 현황 보고서 PDF 저장, 메일 본문 생성
- 역할(관리자/PMO)별 메뉴 제한, 역할별 노출 사업부 제한

**아직 아닌 것**

- 데이터가 **브라우저별로 따로** 저장됩니다. 다른 PC·다른 브라우저와 공유되지 않습니다.
- 로그인은 클라이언트 측 암호 비교입니다. 실제 인증이 아닙니다.

---

## 폴더 구조

```
index.html                 화면 껍데기 (사이드바 · 슬롯만)
vite.config.js             빌드 설정
server/index.js            Express 정적 서버 + /api 자리표시자

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
    settings.js            암호 · 노출 사업부 · 알림 기준일 · 로그인 세션
    ui.js                  화면 상태 (열린 탭, 선택된 행 등)

  data/
    schema.js              ★ 컬렉션 · 필드 정의 (문서이자 코드)
    seed.js                예시 데이터
    store.js               ★ 화면과 저장소 사이의 유일한 통로
    settings-store.js      설정 저장/로드
    adapters/
      local.js             localStorage 어댑터 (현재 사용 중)
      rest.js              REST 어댑터 (실제 DB 연동용 골격)

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
| Web App | `MCB-HR-Management` (Linux 컨테이너, F1 플랜) |
| 레지스트리 | `acrhnfmcb.azurecr.io` — **다른 테넌트**(hnfriends) |
| 이미지 | `acrhnfmcb.azurecr.io/mcb-hr-ops:<태그>` |
| 컨테이너 포트 | `8080` (앱 설정 `WEBSITES_PORT`) |

레지스트리가 다른 테넌트에 있어서 App Service 는 **ACR 관리자 자격 증명**으로
크로스 테넌트 pull 합니다. (관리 ID 는 테넌트를 넘지 못합니다.)

### 1) 수동 배포

두 테넌트 모두 로그인돼 있어야 합니다.

```bash
az login --tenant 033ad662-3b65-45f4-9052-5b0f8d949ff4   # 대상 App Service
az login --tenant 801e055c-c6ad-4711-9dbf-6f91cdbad4ec   # ACR
```

> 대상 테넌트는 조건부 액세스(인증 컨텍스트)를 걸어 두어, Windows 계정 브로커로는
> 단계별 인증이 뜨지 않습니다. 막히면 `az config set core.enable_broker_on_windows=false`
> 로 브라우저 로그인을 쓰세요.

```bash
# 1. 이미지 빌드 (로컬 Docker 불필요 — ACR 에서 빌드)
az acr build -r acrhnfmcb -t mcb-hr-ops:v2 --platform linux/amd64 --no-logs .

# 2. App Service 에 연결 + 재시작
bash scripts/azure-deploy.sh v2
```

`az acr build` 의 로그 스트리밍은 Windows cp949 콘솔에서 Vite 의 `✓` 문자 때문에
죽습니다(azure-cli 이슈). `--no-logs` 를 쓰고 상태는 아래로 확인하세요.

```bash
az acr task list-runs -r acrhnfmcb --top 3 -o table
```

> GitHub Actions 자동 배포는 두지 않았습니다. 대상 테넌트가 SCM 기본 인증을
> 막아 두어(게시 프로필 사용 불가) OIDC 연합 자격 증명이 필요한데, Entra 앱 등록과
> 역할 할당까지 얽혀 1인 개발 단계에서는 값어치보다 품이 큽니다. 필요해지면
> 그때 붙이면 됩니다.

### 2) 확인

```
https://mcb-hr-management-b4f7fma6gkhhecgb.koreacentral-01.azurewebsites.net/healthz
```

`{"ok":true,"service":"mcb-hr-ops",...}` 가 나오면 정상입니다.

F1(무료) 플랜이라 Always On 이 없습니다. 20분간 요청이 없으면 컨테이너가 잠들고,
다음 요청에 **50초 안팎의 콜드 스타트**가 붙습니다. CPU 도 하루 60분 제한입니다.
실사용 단계에서는 B1 이상으로 올리세요.

---

## 실제 DB 를 붙일 때

화면 코드는 **한 줄도 바꿀 필요가 없습니다.** 순서는 이렇습니다.

1. `server/index.js` 의 `/api` 라우터에 엔드포인트를 구현합니다.
   기대하는 형태는 [`src/data/adapters/rest.js`](src/data/adapters/rest.js) 상단 주석에 있습니다.

   ```
   GET    /api/collections        -> { employees:[...], contracts:[...], ... }
   POST   /api/:collection        -> { id }
   PUT    /api/:collection/:id
   PATCH  /api/:collection/:id
   DELETE /api/:collection/:id
   GET    /api/settings
   PUT    /api/settings
   ```

2. `.env` 에 `VITE_DATA_SOURCE=rest` 를 넣고 다시 빌드합니다.
   (`.env.example` 참고)

테이블 설계는 [`src/data/schema.js`](src/data/schema.js) 의 컬렉션·필드 정의를 그대로 쓰면 됩니다.

---

## 이어서 할 일

초안을 정리하면서 확인된, **판단이 필요한 항목**들입니다.

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

2. **로그인을 실제 인증으로 교체.**
   현재는 클라이언트에서 암호 문자열을 비교하며, 변경한 암호는 브라우저 저장소에 평문으로
   남습니다. 사내 계정을 쓰려면 Azure AD(Entra ID) 연동이 자연스럽습니다.

3. **"만료 30일" 기준이 코드 5곳에 박혀 있습니다.**
   시스템 설정의 알림 기준일(수습/계약)과 **별개로** 동작합니다.

   - `src/views/dashboard.js:15` — 계약 만료 임박 집계
   - `src/views/hr-report.js:17` — 보고서의 동일 집계
   - `src/views/employees.js:44` — 인력 마스터 빠른 필터
   - `src/views/evaluations.js:14,19` — 평가 화면 필터

   설정값으로 뺄지 확인이 필요합니다.

4. **데이터 공유.**
   지금은 브라우저별 저장이라 같은 화면을 두 사람이 봐도 내용이 다릅니다.
   여러 명이 함께 쓰려면 위의 "실제 DB 를 붙일 때" 단계가 필요합니다.

---

## 참고

- `_legacy-artifact.html` — 재구성 전 원본 초안 (단일 HTML). 비교용으로 남겨 두었습니다.
