import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/permissions-server";
import type { Permission } from "@/lib/auth/permissions";
import { SESSION_IDLE_TIMEOUT_SECONDS } from "@/lib/auth/config";
import { INVITE_TOKEN_TTL_SECONDS } from "@/lib/auth/password-tokens";

export const metadata = { title: "Help" };

/** Support contact from the environment; anything that isn't a plain address or number is ignored. */
function supportContact() {
  const email = process.env.SUPPORT_EMAIL?.trim() ?? "";
  const phone = process.env.SUPPORT_PHONE?.trim() ?? "";
  return {
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : null,
    phone: /^[+\d][\d\s()-]{3,30}$/.test(phone) ? phone : null,
    name: process.env.SUPPORT_NAME?.trim().slice(0, 80) || "Strategy & Transformation Office",
  };
}

const hours = (seconds: number) => {
  const h = seconds / 3600;
  return h >= 48 && Number.isInteger(h / 24) ? `${h / 24} days` : h === 1 ? "1 hour" : `${+h.toFixed(1)} hours`;
};

const P = ({ children }: { children: ReactNode }) => <p className="leading-relaxed">{children}</p>;
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>
);
const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
);
const Go = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">{children}</Link>
);

type Guide = { id: string; title: string; anyOf?: Permission[]; body: ReactNode };

export default async function HelpPage() {
  const user = await requireUser();
  const can = (...p: Permission[]) => userCan(user, ...p);
  const support = supportContact();
  const idle = Math.round(SESSION_IDLE_TIMEOUT_SECONDS / 60);

  // The yearly cycle, each step pointing at the page where it happens (when this user can open it).
  const cycle: { step: string; who: string; where: string; href?: string; anyOf: Permission[] }[] = [
    { step: "Import or create the plan, then publish it", who: "Strategy office", where: "Strategic Plans", href: "/strategic-plan", anyOf: ["strategic-plan:view"] },
    { step: "Send monthly breakdown requests to activity owners", who: "Strategy office", where: "Strategic Plans → plan", href: "/strategic-plan", anyOf: ["strategic-plan:view"] },
    { step: "Fill in the annual target and the monthly plan, and submit", who: "Activity owner", where: "My Plan", href: "/plan", anyOf: ["my-plan:view"] },
    { step: "Approve or return the breakdowns", who: "Approver", where: "Plan Approvals", href: "/plan/approvals", anyOf: ["plan-approvals:view"] },
    { step: "Set up the reporting period and its cut-off, and send report requests", who: "Strategy office", where: "Configuration → Reporting Periods", href: "/settings/reporting-periods", anyOf: ["settings:view"] },
    { step: "Report the actual to date, with comments and evidence", who: "Activity owner", where: "My Reports", href: "/reports/submit", anyOf: ["my-reports:view"] },
    { step: "Approve or return the reports", who: "Approver", where: "Report Approvals", href: "/reports/approvals", anyOf: ["report-approvals:view"] },
    { step: "Review results, write the summary, and export", who: "Management", where: "Performance Report", href: "/reports", anyOf: ["reports:view", "reports:view-own"] },
  ];

  const guides: Guide[] = [
    {
      id: "breakdown",
      title: "Fill in my monthly breakdown",
      anyOf: ["my-plan:view"],
      body: (
        <Steps items={[
          <>Open <Go href="/plan">My Plan</Go>. You'll see the activities you're responsible for once the strategy office has sent breakdown requests.</>,
          <>For each activity, set the <strong>annual target</strong> and choose whether it's a percentage or a count.</>,
          <>Enter the target for each month you'll work on it. For <strong>cumulative</strong> targets the months add up to the annual target. For <strong>recurring</strong> targets (for example, a ratio you hold every month), each month repeats the level you'll keep.</>,
          <>Submit. Your breakdown goes to <strong>Plan Approvals</strong>. If it's returned, fix what the approver noted and submit again.</>,
          <>Need an activity that isn't in the plan? Use <strong>Add another activity</strong> under the same initiative. It starts with weight 0 and is approved together with its breakdown.</>,
        ]} />
      ),
    },
    {
      id: "report",
      title: "Submit my progress report",
      anyOf: ["my-reports:view"],
      body: (
        <Steps items={[
          <>Open <Go href="/reports/submit">My Reports</Go>. An activity appears once a report has been requested for the period, which happens when it has planned work in that period's months.</>,
          <>Enter the <strong>actual achieved up to the end of the period</strong>, not just this period's share. Actuals are cumulative: they can't be lower than what was approved for an earlier period.</>,
          <>If the actual is below plan, <strong>Reason for variation</strong> and <strong>Way forward</strong> are required.</>,
          <>When the annual target is reached, enter the <strong>completion date</strong>. Finishing more than 30 days after the last planned month reduces the score (see "How results are calculated").</>,
          <>Attach evidence if you have it, then submit. You can still submit after the cut-off date, but the report is marked late. Only a <em>closed</em> period refuses reports.</>,
          <>If the report is returned, read the reviewer's comment, correct it and submit again.</>,
        ]} />
      ),
    },
    {
      id: "approve",
      title: "Approve or return breakdowns and reports",
      anyOf: ["plan-approvals:view", "report-approvals:view"],
      body: (
        <Bullets items={[
          <><Go href="/plan/approvals">Plan Approvals</Go> lists monthly breakdowns waiting for you. <Go href="/reports/approvals">Report Approvals</Go> lists period reports.</>,
          <>Approve when the numbers and comments hold up. <strong>Return</strong> with a clear comment when the owner needs to change something; they're notified and can resubmit.</>,
          <>You can't approve your own work. Anything you're responsible for, or submitted yourself, has to be approved by someone else.</>,
          <>An approved report counts in the Performance Report straight away and can't be edited afterwards.</>,
        ]} />
      ),
    },
    {
      id: "periods",
      title: "Set up a reporting period and request reports",
      anyOf: ["settings:view"],
      body: (
        <Steps items={[
          <>Open <Go href="/settings/reporting-periods">Configuration → Reporting Periods</Go> and choose <strong>Add Period</strong>: give it a name, start and end dates, and a cut-off date.</>,
          <>Periods follow each other. Results are always measured <strong>from the start of the plan up to the period's end month</strong>, so a period ending in October shows year-to-date results up to October.</>,
          <>Use <strong>Send request</strong> on the period. Every activity with an approved breakdown and a planned target in one of the period's months gets a request. Activities with nothing planned in those months aren't asked to report.</>,
          <>Use <strong>Send again</strong> to remind owners who haven't submitted. Close the period when reporting is final.</>,
        ]} />
      ),
    },
    {
      id: "import",
      title: "Import a period's report from Excel",
      anyOf: ["report-approvals:approve"],
      body: (
        <>
          <Steps items={[
            <>On <Go href="/reports">Performance Report</Go>, choose <strong>Import report</strong> and upload the report template or the full cascaded sheet.</>,
            <>Pick a period that <strong>ends in the month the sheet reports up to</strong>, or create one.</>,
            <>Check the preview. Use <strong>Will import / Skipped</strong> to review every row with its actual, completion date and comments.</>,
            <>Imported rows are saved as <strong>approved</strong> reports. Reports already submitted or approved for that period are never overwritten.</>,
          ]} />
          <p className="mt-3 font-medium">Why rows are skipped</p>
          <Table className="mt-1">
            <TableBody>
              {[
                ["Your own activity", "You're the responsible person, so an imported (already approved) report would be self-approved. Someone else must import it, or the owner submits it normally. If you aren't really the owner, ask an admin to make the right person responsible."],
                ["No actual", "The Actual cell is empty. Enter 0 if nothing was achieved yet."],
                ["Invalid value", "The Actual isn't a number (for example \"N/A\"), is negative, or is a percentage above 100%."],
                ["Not matched", "The title must match the plan word for word (spacing and capitals are ignored), and the Lead/Owner must match too."],
                ["No breakdown", "The activity's monthly breakdown isn't approved, or it has no annual target."],
                ["Below last period", "Cumulative actuals can't go down from an earlier approved period."],
                ["Repeated row", "The same activity appears twice in the sheet. Keep one row."],
              ].map(([k, v]) => (
                <TableRow key={k}><TableCell className="w-40 align-top font-medium">{k}</TableCell><TableCell className="text-muted-foreground">{v}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ),
    },
    {
      id: "users",
      title: "Add a user or change who owns activities",
      anyOf: ["users:view"],
      body: (
        <Bullets items={[
          <>In <Go href="/users">Users &amp; Roles</Go>, choose <strong>Register User</strong>. They're emailed a link to set their password, valid for {hours(INVITE_TOKEN_TTL_SECONDS)}. Use <strong>Resend invite</strong> if it expires.</>,
          <>Set each person's <strong>Lead Owner</strong> (the office they hold, for example Chief Strategy Officer). Plan imports use it to make them responsible for that office's activities.</>,
          <>What someone can see and do comes from their <strong>role</strong>. Edit role permissions under Users &amp; Roles.</>,
          <>To fix a mistyped email, edit the user. They're signed out and must sign in with the new address.</>,
        ]} />
      ),
    },
  ];
  const myGuides = guides.filter(g => !g.anyOf || can(...g.anyOf));

  const faqs: { q: string; a: ReactNode }[] = [
    { q: "I can't see a menu item a colleague has", a: <P>The menu shows only what your role allows. Ask an administrator to check your role in Users &amp; Roles.</P> },
    { q: "My activity isn't in My Reports", a: <P>A report is requested only for activities with an approved breakdown and a planned target in the period's months. If your breakdown is still pending or returned, finish it in My Plan first. Otherwise ask the strategy office to send the request.</P> },
    { q: "It says my actual can't be lower than last period", a: <P>Actuals are cumulative (total achieved to date). Enter the running total, not this period's increase. If the earlier figure was wrong, ask the strategy office to correct it.</P> },
    { q: "I submitted after the cut-off. Does it still count?", a: <P>Yes. It's accepted and marked late. Only a closed period stops submissions.</P> },
    { q: "My invitation or reset link doesn't work", a: <P>Links can be used once. Invitations last {hours(INVITE_TOKEN_TTL_SECONDS)}, and password-reset links last 1 hour. Use <strong>Forgot password?</strong> on the sign-in page, or ask an administrator to resend your invitation.</P> },
    { q: "I was signed out while working", a: <P>For security you're signed out after {idle} minutes without activity, and when your password or email changes. Unsaved form entries are lost, so save as you go.</P> },
    { q: "How do I change my name, password or email?", a: <P>On your <Go href="/profile">Profile</Go>. An email change is confirmed from a link sent to the new address.</P> },
    { q: "Can I export the report?", a: <P>Yes. On Performance Report, use <strong>Export</strong> for Excel or PDF of the selected period. The Report summary page holds the narrative for that period.</P> },
  ];

  const statuses = [
    ["Completed As Per The Target", "100% or more"],
    ["In Good Progress", "75% to under 100%"],
    ["Not In Good Progress", "above 0% to under 75%"],
    ["Not Started", "0%"],
    ["No Target", "nothing was planned up to the period"],
  ];
  const penalties = [
    ["Up to 30 days late", "no reduction"],
    ["31–60 days", "achievement × 90%"],
    ["61–90 days", "achievement × 80%"],
    ["More than 90 days", "achievement × 50%"],
  ];

  const mailSubject = encodeURIComponent("Strategic Plan support request");
  const mailBody = encodeURIComponent(`Name: ${user.name}\nRole: ${user.role}\nPage (link):\nActivity / period (if any):\nWhat happened:\nWhat I expected:\n\n(Attach a screenshot if you can.)`);

  return (
    <div className="flex-1 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="text-muted-foreground">How planning and reporting work here, what to do in your role, and how results are scored.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>How the year works</CardTitle>
              <CardDescription>Each step happens on its own page. Links appear for the pages your role can open.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {cycle.map((c, i) => {
                  const open = c.href && can(...c.anyOf);
                  return (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{c.step}</p>
                        <p className="text-muted-foreground">
                          {c.who} · {open ? <Link href={c.href!} className="inline-flex items-center gap-1 text-primary hover:underline">{c.where} <ArrowRight className="h-3 w-3" /></Link> : c.where}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {myGuides.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Guides for your role</CardTitle>
                <CardDescription>Step-by-step instructions for what you can do as {user.role}.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {myGuides.map(g => (
                    <AccordionItem key={g.id} value={g.id}>
                      <AccordionTrigger className="text-left">{g.title}</AccordionTrigger>
                      <AccordionContent className="space-y-2 text-sm">{g.body}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          <Card id="scoring">
            <CardHeader>
              <CardTitle>How results are calculated</CardTitle>
              <CardDescription>The same formulas as the cascaded initiatives sheet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="space-y-2">
                <p className="font-medium">For each activity</p>
                <Bullets items={[
                  <><strong>Plan up to the period</strong>: the monthly targets from the start of the plan to the period's end month, added up for cumulative targets or the highest month for recurring ones.</>,
                  <><strong>% achievement</strong> = actual ÷ plan to date. For "lower is better" targets it's plan ÷ actual, and reaching 0 counts as met.</>,
                  <><strong>Weight for the period</strong> = activity weight × plan to date ÷ annual target. An activity planned to finish later carries only part of its weight now.</>,
                  <><strong>Weighted plan</strong> is that weight. <strong>Weighted actual</strong> is the weight × achievement, capped at the weight, so overachieving doesn't count extra.</>,
                  <>Duplicated activities (the same work listed under several initiatives) count once in the "No Dup" totals.</>,
                ]} />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Initiatives, objectives, pillars and the whole plan</p>
                <P><strong>Achieved result</strong> = total weighted actual ÷ total weighted plan of the activities under it. This is the percentage on the Performance Report cards. It's a share of what was planned <em>so far</em>, not of the whole year.</P>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium">Status</p>
                  <Table>
                    <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Achieved result</TableHead></TableRow></TableHeader>
                    <TableBody>{statuses.map(([s, r]) => <TableRow key={s}><TableCell>{s}</TableCell><TableCell className="text-muted-foreground">{r}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
                <div>
                  <p className="mb-1 font-medium">Delay ("with delay" columns)</p>
                  <Table>
                    <TableHeader><TableRow><TableHead>Completed after the last planned month</TableHead><TableHead>Effect</TableHead></TableRow></TableHeader>
                    <TableBody>{penalties.map(([d, e]) => <TableRow key={d}><TableCell>{d}</TableCell><TableCell className="text-muted-foreground">{e}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Contact support</CardTitle>
              <CardDescription>{support.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {support.email || support.phone ? (
                <>
                  {support.email && (
                    <a href={`mailto:${support.email}?subject=${mailSubject}&body=${mailBody}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                      <Mail className="h-4 w-4 shrink-0" /> <span className="break-all">{support.email}</span>
                    </a>
                  )}
                  {support.phone && (
                    <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                      <Phone className="h-4 w-4 shrink-0" /> {support.phone}
                    </a>
                  )}
                </>
              ) : (
                <P>Contact your system administrator.</P>
              )}
              <div>
                <p className="mb-1 font-medium">To get help faster, include</p>
                <Bullets items={[
                  "The page link from your browser's address bar",
                  "The activity and reporting period involved",
                  "What you did and the exact message you saw",
                  "A screenshot",
                ]} />
              </div>
              <p className="text-xs text-muted-foreground">Signed in as {user.name} ({user.role}).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
