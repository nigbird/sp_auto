import { guardPage } from "@/lib/auth/page-guard";

export default async function StrategicPlanLayout({ children }: { children: React.ReactNode }) {
  const { denied } = await guardPage("strategic-plan:view");
  return denied ?? children;
}
