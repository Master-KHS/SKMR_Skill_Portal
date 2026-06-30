/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 정적 HTML 추출 (시연용) — Netlify/GitHub Pages 등 정적 호스팅에 그대로 업로드 가능.
  // 서버 기능이 없으므로 검색은 브라우저에서 실행, Gemini는 클라이언트에서 직접 호출.
  output: "export",
  images: { unoptimized: true },
  // 정적 호스팅에서 새로고침 시 404 방지
  trailingSlash: true,
};

export default nextConfig;
