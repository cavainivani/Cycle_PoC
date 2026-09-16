import globals from "globals";

export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // CDN 으로 로드되는 전역 라이브러리 (index.html 의 <script> 참조)
        XLSX: "readonly",
        ExcelJS: "readonly",
        html2canvas: "readonly",
        jspdf: "readonly",
      },
    },
    rules: {
      // 모듈 분리 과정에서 빠뜨린 import 를 잡아내는 것이 이 설정의 핵심 목적이다.
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["server/**/*.js", "db/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },
];
