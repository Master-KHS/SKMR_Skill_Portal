import type { Metadata } from "next";
import "./globals.css";
import { PersonaProvider } from "@/components/PersonaContext";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "SKMR Skill Portal",
  description: "SK머티리얼즈 Skill 관리 시스템",
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
