import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { forbiddenResponse, userCan } from '@/lib/auth/permissions-server';
import { buildReportTemplate } from '@/lib/plan-export/import-templates';

export const dynamic = 'force-dynamic';

/** The report import template: its columns and two example rows. */
export async function GET() {
  const user = await requireUser();
  if (!userCan(user, 'report-approvals:approve')) {
    return forbiddenResponse(["report-approvals:approve"], "You don't have permission to import reports.");
  }
  const buffer = buildReportTemplate();
  const fileName = 'Report import template.xlsx';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
