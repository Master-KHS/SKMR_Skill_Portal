/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone: 실행에 필요한 최소 node_modules까지 포함한 자체 실행본 생성.
  // → 배포처에서 npm install 없이 `node server.js` 만으로 구동 (사내 폐쇄망 대응).
  output: "standalone",
  // 이미지 최적화 비활성화 → sharp(네이티브) 런타임 의존 제거, OS 이식성 확보.
  images: { unoptimized: true },
};

export default nextConfig;
