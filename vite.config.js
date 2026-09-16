import { defineConfig } from "vite";

export default defineConfig({
  // Azure App Service 는 사이트 루트에 배포되므로 base 는 "/" 그대로 둔다.
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // 엑셀/PDF 라이브러리가 커서 기본 경고 임계치(500kB)를 넘는다. 의도된 것이라 올려 둔다.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // VITE_DATA_SOURCE=rest 로 개발할 때 API 호출을 로컬 Express 서버로 넘긴다.
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
