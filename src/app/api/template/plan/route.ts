import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { userCan } from '@/lib/auth/permissions-server';
import { buildPlanTemplate } from '@/lib/plan-export/import-templates';

export const dynamic = 'force-dynamic';

/** The blank strategic plan template for the plan import, for fiscal year `?year=` (Jul–Jun; defaults to the current one). */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!userCan(user, 'strategic-plan:edit')) {
    return NextResponse.json({ error: "You don't have permission to import plans." }, { status: 403 });
  }
  const now = new Date();
  const currentFiscalYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const requested = Number(request.nextUrl.searchParams.get('year'));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentFiscalYear;

  const buffer = buildPlanTemplate(year);
  const fileName = `Strategic plan import template ${year}-${String(year + 1).slice(-2)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
