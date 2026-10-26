-- Tables (from the dashboard's figures) attached to report summary sections.
ALTER TABLE "ReportSummarySection" ADD COLUMN "tables" TEXT[] DEFAULT ARRAY[]::TEXT[];
