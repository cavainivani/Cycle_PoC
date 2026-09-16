#!/usr/bin/env bash
# =========================================================
#  mcb-hr-ops -> Azure App Service (Linux 컨테이너) 배포
#  ---------------------------------------------------------
#  사용법:  bash scripts/azure-deploy.sh [태그]
#           태그 생략 시 v3
#
#  사전 조건:
#    - az login (daniel.lee@mcloudbridge.com)
#    - 이미지가 ACR 에 빌드돼 있을 것
#        az acr build -r acrmcbhrops -t mcb-hr-ops:<태그> --platform linux/amd64 --no-logs .
#
#  ★ 레지스트리·App Service·SQL 이 전부 같은 구독(DataSolution)에 있다.
#    예전에는 이미지를 다른 테넌트(hnfriends)의 acrhnfmcb 에서 받아왔는데,
#    그 레지스트리는 다른 프로젝트 소유라 더는 쓰지 않는다.
# =========================================================
set -euo pipefail

TAG="${1:-v3}"

SUB="8151e37b-7d16-4a46-8b6e-aa1cbb7e64dd"   # DataSolution(Dev)
RG="MCB_IS_HR_Management_RG"
APP="MCB-HR-Management"
ACR_NAME="acrmcbhrops"

REGISTRY="${ACR_NAME}.azurecr.io"
IMAGE="${REGISTRY}/mcb-hr-ops:${TAG}"

echo "▶ 이미지  : ${IMAGE}"
echo "▶ 대상 앱 : ${APP} (${RG})"
echo

echo "[1/3] ACR 자격증명 조회..."
# 관리 ID 로 pull 하는 편이 깨끗하지만, AcrPull 역할 할당에는
# Owner / User Access Administrator 권한이 필요하다. 현재 계정은
# Contributor 라 관리자 자격증명을 쓴다. 권한이 생기면 전환할 것.
ACR_USER="$(az acr credential show -n "$ACR_NAME" -g "$RG" --subscription "$SUB" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR_NAME" -g "$RG" --subscription "$SUB" --query 'passwords[0].value' -o tsv)"
echo "      확보 완료 (값은 출력하지 않음)"

echo "[2/3] 컨테이너 이미지 연결..."
az webapp config container set \
  -n "$APP" -g "$RG" --subscription "$SUB" \
  --container-image-name "$IMAGE" \
  --container-registry-url "https://${REGISTRY}" \
  --container-registry-user "$ACR_USER" \
  --container-registry-password "$ACR_PASS" \
  -o none

echo "[3/3] 재시작..."
az webapp restart -n "$APP" -g "$RG" --subscription "$SUB" -o none

HOST="$(az webapp show -n "$APP" -g "$RG" --subscription "$SUB" --query defaultHostName -o tsv)"
echo
echo "완료. 컨테이너를 내려받는 데 1~3분 걸립니다."
echo "  앱        : https://mcb-hr-management.mcloudbridge.co.kr"
echo "  헬스체크  : https://mcb-hr-management.mcloudbridge.co.kr/healthz"
echo "  DB 확인   : https://mcb-hr-management.mcloudbridge.co.kr/api/health/db"
echo "  (기본 주소: https://${HOST})"
echo
echo "로그 확인:"
echo "  az webapp log tail -n ${APP} -g ${RG} --subscription ${SUB}"
