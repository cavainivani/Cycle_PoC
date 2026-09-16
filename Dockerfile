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
#  Azure(ACR 클라우드 빌드 · 로컬 Docker 불필요):
#    az acr build -r acrmcbhrops -t mcb-hr-ops:<tag> --platform linux/amd64 --no-logs .
# =========================================================

# ---------- 1) build ----------
FROM node:20-alpine AS build
WORKDIR /app

# ★ 프론트엔드의 데이터 소스는 빌드 시점에 번들에 박힌다.
#   .dockerignore 가 .env.local 을 제외하므로 여기서 명시해야 한다.
#   이 값이 local 이면 배포해도 브라우저 localStorage 를 쓴다.
ARG VITE_DATA_SOURCE=rest
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && \
    node -e "const fs=require('fs'),p='dist/assets';const f=fs.readdirSync(p).find(n=>n.startsWith('index-')&&n.endsWith('.js'));const s=fs.readFileSync(p+'/'+f,'utf8');if(!s.includes('VITE_DATA_SOURCE:\"$VITE_DATA_SOURCE\"')){console.error('빌드 결과의 데이터 소스가 $VITE_DATA_SOURCE 가 아닙니다.');process.exit(1)}console.log('[build] 데이터 소스 = $VITE_DATA_SOURCE 확인됨')"

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
