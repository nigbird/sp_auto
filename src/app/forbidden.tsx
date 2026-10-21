import { NoAccess } from "@/components/no-access";

/** Rendered whenever guardPage() refuses a page (src/lib/auth/page-guard.tsx). */
export default function Forbidden() {
  return <NoAccess />;
}
