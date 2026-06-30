import { NAV_ITEMS } from "@/lib/nav";
import { PageHeader, Card, Badge } from "@/components/ui";
import { notFound } from "next/navigation";

// 정적 추출: 이식 예정 메뉴들을 미리 정적 페이지로 생성.
// 명시적 라우트(dashboard/talent-search/assistant)는 제외.
const EXPLICIT = new Set([
  "dashboard",
  "talent-search",
  "assistant",
  "self-assess",
  "skill-master",
  "member-mgmt",
  "required-skill",
  "skill-profile",
]);
export function generateStaticParams() {
  return NAV_ITEMS.filter((i) => !EXPLICIT.has(i.key)).map((i) => ({
    slug: i.key.split("/"),
  }));
}

// 아직 Next.js로 이식되지 않은 화면용 플레이스홀더.
// 명시적 라우트(dashboard/talent-search/assistant)가 우선하며, 그 외 메뉴는 여기로 떨어짐.
export default async function Placeholder({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const key = slug.join("/");
  const item = NAV_ITEMS.find((i) => i.key === key);
  if (!item) notFound();

  return (
    <div>
      <PageHeader title={item.title} desc={`${item.section} · 이식 예정 화면`} />
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Badge tone="warning" label="상태: 이식 예정" />
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          이 화면은 기존 Streamlit 버전에 존재하며, Next.js 이식 대기 중입니다.
          <br />
          현재 완성된 화면: <strong>진단 결과 확인(대시보드)</strong>,{" "}
          <strong>Talent Search</strong>, <strong>AI 인재 검색</strong>.
        </p>
      </Card>
    </div>
  );
}
