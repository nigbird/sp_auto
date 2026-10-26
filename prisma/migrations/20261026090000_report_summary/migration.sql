-- Narrative report summary per reporting period, editable before export.
ALTER TABLE "AppConfig" ADD COLUMN "summaryCorrections" JSONB;

CREATE TABLE "ReportSummary" (
    "id" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSummarySection" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "generatedBody" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "editedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSummarySection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportSummary_reportingPeriodId_key" ON "ReportSummary"("reportingPeriodId");
CREATE UNIQUE INDEX "ReportSummarySection_summaryId_key_key" ON "ReportSummarySection"("summaryId", "key");
CREATE INDEX "ReportSummarySection_summaryId_position_idx" ON "ReportSummarySection"("summaryId", "position");

ALTER TABLE "ReportSummary" ADD CONSTRAINT "ReportSummary_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSummarySection" ADD CONSTRAINT "ReportSummarySection_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "ReportSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The new "Generate and edit the report summary" permission goes to every role that can already approve reports.
INSERT INTO "RolePermission" ("id", "roleId", "permission", "createdAt")
SELECT 'rp_' || md5(rp."roleId" || 'reports:summary' || clock_timestamp()::text), rp."roleId", 'reports:summary', NOW()
FROM "RolePermission" rp
WHERE rp."permission" = 'report-approvals:approve'
ON CONFLICT ("roleId", "permission") DO NOTHING;
