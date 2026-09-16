# =========================================================
#  mcb-hr-ops — Azure App Service (Linux 컨테이너)
#  ---------------------------------------------------------
#  build 단계에서 Vite 로 dist/ 를 만들고,
#  runtime 단계에는 운영 의존성 + dist + server 만 남긴다.
#
#  로컬 확인:
#    docker build -t mcb-hr-ops .
#    docker run --rm -p 8080:8080 mcb-hr-ops
#
#  Azure(ACR 클라우드 빌드):
#    az acr build -r acrhnfmcb -t mcb-hr-ops:<tag> .
# =========================================================

# ---------- 1) build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- 2) runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

# node:alpine 이미지에 이미 있는 비루트 계정으로 낮춘다.
USER node

EXPOSE 8080
CMD ["node", "server/index.js"]
