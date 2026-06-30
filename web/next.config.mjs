/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 서버 모드 — API 라우트 + 로컬 SQLite로 데이터 영구 저장.
  // better-sqlite3는 네이티브 모듈이므로 번들 대상에서 제외.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
