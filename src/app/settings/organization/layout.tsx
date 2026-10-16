/**
 * The lead-owner offices (e.g. "Chief Strategy Officer") that lead and
 * collaborate on activities. People are linked to an office under Users & Roles.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Lead Owners</h2>
        <p className="text-sm text-muted-foreground">
          The offices (e.g. &ldquo;Chief Strategy Officer&rdquo;) that lead activities and collaborate on them. Link people to their office under Users &amp; Roles.
        </p>
      </div>
      {children}
    </div>
  );
}
