/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // node:sqlite(내장)를 사용하므로 별도 네이티브 패키지 외부화 불필요.
};

export default nextConfig;
