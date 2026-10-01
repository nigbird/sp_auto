/**
 * Every event the audit log records, with the label and category shown on
 * the Audit Log page. Client-safe: the page uses this for its filters.
 * Server code writes events through src/lib/auth/audit.ts.
 */
export const AUDIT_CATEGORIES = [
  'Sign-in & security',
  'Users & roles',
  'Strategic plans',
  'Activities',
  'Plan approvals',
  'Reporting',
  'Configuration',
  'Exports',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_ACTIONS = {
  // Sign-in & security
  LOGIN_SUCCESS: { label: 'Signed in', category: 'Sign-in & security' },
  LOGIN_FAILURE: { label: 'Failed sign-in', category: 'Sign-in & security' },
  LOGOUT: { label: 'Signed out', category: 'Sign-in & security' },
  TOKEN_REFRESH: { label: 'Session refreshed', category: 'Sign-in & security' },
  SESSION_REVOKED: { label: 'Session revoked', category: 'Sign-in & security' },
  PASSWORD_RESET_REQUEST: { label: 'Requested a password reset', category: 'Sign-in & security' },
  PASSWORD_SET: { label: 'Set password from link', category: 'Sign-in & security' },
  PASSWORD_CHANGE: { label: 'Changed password', category: 'Sign-in & security' },

  // Users & roles
  USER_CREATED: { label: 'Registered a user', category: 'Users & roles' },
  USER_UPDATED: { label: 'Edited a user', category: 'Users & roles' },
  USER_ACTIVATED: { label: 'Activated a user', category: 'Users & roles' },
  USER_DEACTIVATED: { label: 'Deactivated a user', category: 'Users & roles' },
  INVITE_SENT: { label: 'Sent an invitation', category: 'Users & roles' },
  PROFILE_UPDATED: { label: 'Changed own name', category: 'Users & roles' },
  ROLE_CREATED: { label: 'Created a role', category: 'Users & roles' },
  ROLE_PERMISSIONS_UPDATED: { label: 'Changed role permissions', category: 'Users & roles' },
  ROLE_DELETED: { label: 'Deleted a role', category: 'Users & roles' },

  // Strategic plans
  PLAN_CREATED: { label: 'Created a plan', category: 'Strategic plans' },
  PLAN_UPDATED: { label: 'Edited a plan', category: 'Strategic plans' },
  PLAN_IMPORTED: { label: 'Imported a plan', category: 'Strategic plans' },
  PLAN_PUBLISHED: { label: 'Published a plan', category: 'Strategic plans' },
  PLAN_ACTIVATED: { label: 'Activated a plan', category: 'Strategic plans' },
  PLAN_DEACTIVATED: { label: 'Deactivated a plan', category: 'Strategic plans' },
  PLAN_DELETED: { label: 'Deleted a plan', category: 'Strategic plans' },

  // Activities
  ACTIVITY_CREATED: { label: 'Created an activity', category: 'Activities' },
  ACTIVITY_UPDATED: { label: 'Edited an activity', category: 'Activities' },
  ACTIVITY_MONTHLY_PLAN_SET: { label: 'Set monthly plan', category: 'Activities' },
  ACTIVITY_DUPLICATE_LINKED: { label: 'Linked duplicate activity', category: 'Activities' },
  ACTIVITY_DUPLICATE_UNLINKED: { label: 'Unlinked duplicate activity', category: 'Activities' },
  DELIVERABLE_CREATED: { label: 'Added a deliverable', category: 'Activities' },
  DELIVERABLE_DELIVERED: { label: 'Marked deliverable delivered', category: 'Activities' },
  DELIVERABLE_UNDELIVERED: { label: 'Marked deliverable not delivered', category: 'Activities' },
  DELIVERABLE_DELETED: { label: 'Deleted a deliverable', category: 'Activities' },

  // Plan approvals
  BREAKDOWN_REQUESTS_SENT: { label: 'Sent breakdown requests', category: 'Plan approvals' },
  BREAKDOWN_SUBMITTED: { label: 'Submitted a breakdown', category: 'Plan approvals' },
  ACTIVITY_PROPOSED: { label: 'Proposed a new activity', category: 'Plan approvals' },
  BREAKDOWN_APPROVED: { label: 'Approved a breakdown', category: 'Plan approvals' },
  BREAKDOWN_RETURNED: { label: 'Returned a breakdown', category: 'Plan approvals' },
  NEW_ACTIVITY_APPROVED: { label: 'Approved a new activity', category: 'Plan approvals' },
  NEW_ACTIVITY_RETURNED: { label: 'Returned a new activity', category: 'Plan approvals' },

  // Reporting
  REPORT_REQUESTS_SENT: { label: 'Sent report requests', category: 'Reporting' },
  REPORT_SUBMITTED: { label: 'Submitted a report', category: 'Reporting' },
  REPORT_APPROVED: { label: 'Approved a report', category: 'Reporting' },
  REPORT_RETURNED: { label: 'Returned a report', category: 'Reporting' },
  EVIDENCE_UPLOADED: { label: 'Uploaded evidence', category: 'Reporting' },
  EVIDENCE_DELETED: { label: 'Removed evidence', category: 'Reporting' },
  PROGRESS_UPDATE_SUBMITTED: { label: 'Submitted a progress update', category: 'Reporting' },
  PROGRESS_UPDATE_APPROVED: { label: 'Approved a progress update', category: 'Reporting' },
  PROGRESS_UPDATE_RETURNED: { label: 'Returned a progress update', category: 'Reporting' },

  // Configuration
  REPORTING_PERIOD_CREATED: { label: 'Created a reporting period', category: 'Configuration' },
  REPORTING_PERIOD_UPDATED: { label: 'Edited a reporting period', category: 'Configuration' },
  REPORTING_PERIOD_DELETED: { label: 'Deleted a reporting period', category: 'Configuration' },
  RULE_CREATED: { label: 'Created a status rule', category: 'Configuration' },
  RULE_UPDATED: { label: 'Edited a status rule', category: 'Configuration' },
  RULE_DELETED: { label: 'Deleted a status rule', category: 'Configuration' },
  ACHIEVEMENT_CAP_UPDATED: { label: 'Changed the achievement cap', category: 'Configuration' },
  RATING_THRESHOLDS_UPDATED: { label: 'Changed rating thresholds', category: 'Configuration' },
  RATING_THRESHOLDS_RESET: { label: 'Reset rating thresholds', category: 'Configuration' },
  DEPARTMENT_CREATED: { label: 'Created a department', category: 'Configuration' },
  DEPARTMENT_RENAMED: { label: 'Renamed a department', category: 'Configuration' },
  DEPARTMENT_DELETED: { label: 'Deleted a department', category: 'Configuration' },
  LEAD_OWNER_CREATED: { label: 'Created a lead owner', category: 'Configuration' },
  LEAD_OWNER_UPDATED: { label: 'Edited a lead owner', category: 'Configuration' },
  LEAD_OWNER_DELETED: { label: 'Deleted a lead owner', category: 'Configuration' },

  // Exports
  PLAN_EXPORTED: { label: 'Exported a plan', category: 'Exports' },
  DASHBOARD_EXPORTED: { label: 'Exported the dashboard', category: 'Exports' },
  ACTIVITIES_EXPORTED: { label: 'Exported activities', category: 'Exports' },
  AUDIT_LOG_EXPORTED: { label: 'Exported the audit log', category: 'Exports' },
} as const satisfies Record<string, { label: string; category: AuditCategory }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;
}

export function auditActionCategory(action: string): AuditCategory | null {
  return (AUDIT_ACTIONS as Record<string, { category: AuditCategory }>)[action]?.category ?? null;
}

export function auditActionsIn(category: AuditCategory): AuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter((a) => AUDIT_ACTIONS[a].category === category);
}
