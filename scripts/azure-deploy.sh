#!/usr/bin/env bash
# =========================================================
#  mcb-hr-ops -> Azure App Service (Linux 컨테이너) 배포
#  ---------------------------------------------------------
#  사용법:  bash scripts/azure-deploy.sh [태그]
#           태그 생략 시 v1
#
#  사전 조건:
#    - az login 으로 두 계정 모두 로그인돼 있을 것
#        · mcloud@hnfriends.com      (ACR acrhnfmcb 보유)
#        · daniel.lee@mcloudbridge.com (대상 App Service 보유)
#    - 이미지가 ACR 에 이미 빌드돼 있을 것
#        az acr build -r acrhnfmcb -t mcb-hr-ops:<태그> --platform linux/amd64 .
# =========================================================
set -euo pipefail

TAG="${1:-v1}"

# ACR 이 있는 구독 (hnfriends 테넌트)
SRC_SUB="afee35fb-115d-4cff-960b-f33723f67cd1"
ACR_NAME="acrhnfmcb"

# App Service 가 있는 구독 (mcloudbridge 테넌트)
DST_SUB="8151e37b-7d16-4a46-8b6e-aa1cbb7e64dd"
APP="MCB-HR-Management"
RG="MCB_IS_HR_Management_RG"

REGISTRY="${ACR_NAME}.azurecr.io"
IMAGE="${REGISTRY}/mcb-hr-ops:${TAG}"

echo "▶ 이미지      : ${IMAGE}"
echo "▶ 대상 앱     : ${APP} (${RG})"
echo

echo "[1/4] ACR 자격증명 조회..."
ACR_USER="$(az acr credential show -n "$ACR_NAME" --subscription "$SRC_SUB" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR_NAME" --subscription "$SRC_SUB" --query 'passwords[0].value' -o tsv)"
echo "      확보 완료 (값은 출력하지 않음)"

echo "[2/4] 컨테이너 이미지 연결..."
az webapp config container set \
  -n "$APP" -g "$RG" --subscription "$DST_SUB" \
  --container-image-name "$IMAGE" \
  --container-registry-url "https://${REGISTRY}" \
  --container-registry-user "$ACR_USER" \
  --container-registry-password "$ACR_PASS" \
  -o none

echo "[3/4] 앱 설정 (컨테이너 포트 8080)..."
az webapp config appsettings set \
  -n "$APP" -g "$RG" --subscription "$DST_SUB" \
  --settings WEBSITES_PORT=8080 WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
  -o none

echo "[4/4] 재시작..."
az webapp restart -n "$APP" -g "$RG" --subscription "$DST_SUB" -o none

HOST="$(az webapp show -n "$APP" -g "$RG" --subscription "$DST_SUB" --query defaultHostName -o tsv)"
echo
echo "완료. 컨테이너를 처음 내려받는 데 1~3분 걸립니다."
echo "  앱      : https://${HOST}"
echo "  헬스체크: https://${HOST}/healthz"
echo
echo "로그 확인:"
echo "  az webapp log tail -n ${APP} -g ${RG} --subscription ${DST_SUB}"
