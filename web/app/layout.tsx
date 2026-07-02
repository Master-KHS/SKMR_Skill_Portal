import type { Metadata } from "next";
import "./globals.css";
import { PersonaProvider } from "@/components/PersonaContext";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Skill 기반 인재관리 Agent",
  description: "Skill 기반 진단 관리 시스템과 AI 인재검색 에이전트",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <PersonaProvider>
          <Shell>{children}</Shell>
        </PersonaProvider>
      </body>
    </html>
  );
}
