import type { Config } from "tailwindcss";

// 디자인 조건(사용자 지정): SK Red 기반, 각진/네모난 형태(라운드 최소화), 깔끔.
// 색상은 의미 기반으로만 사용하고 항상 텍스트 라벨을 동반.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "sk-red": "#EA002C", // 오류·보안·개인정보·필수 확인·삭제·실제 발송
        "sk-orange": "#FF7A00", // 실행·진행·주요 버튼·복사·생성 완료
        "bg-main": "#F5F7FA",
        "bg-surface": "#FFFFFF",
        "text-main": "#1F2933",
        "text-muted": "#5F6B7A",
        "border-soft": "#D9DEE7",
        success: "#16A34A", // 정상 완료·검증 통과
        warning: "#F59E0B", // 주의·검토 필요
        info: "#2563EB", // 참고 정보·중립 안내
      },
      borderRadius: {
        // 각진 디자인: 라운드 최소화. 기본은 0, 미세한 sm만 허용.
        DEFAULT: "0px",
        none: "0px",
        sm: "2px",
        md: "2px",
        lg: "2px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
