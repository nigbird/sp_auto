
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-lg text-muted-foreground mt-2">We're here to help you get the most out of the Corp-Plan Dashboard.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Find answers to common questions about the Corp-Plan Dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a new activity?</AccordionTrigger>
                  <AccordionContent>
                    You can create a new activity by navigating to the "Activities" page and clicking the "Create Activity" button. This will open a form where you can enter the details of the activity.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>How is progress calculated in reports?</AccordionTrigger>
                  <AccordionContent>
                    Progress is calculated based on a weighted average. Each activity has a progress percentage and a weight. This rolls up to initiatives, then to objectives, and finally to pillars.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Can I export reports?</AccordionTrigger>
                  <AccordionContent>
                    Yes, on the "Reports" page, you will find options to export the full hierarchical report to both Excel and PDF formats.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I filter the activity table?</AccordionTrigger>
                  <AccordionContent>
                    On the "Activities" page, you can use the search bar to filter activities by title. More advanced filtering options for status and department are also available above the table.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
              <CardDescription>
                Still need help? Contact our support team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>You can reach our support team by emailing <a href="mailto:support@corp-plan.com" className="text-primary underline">support@corp-plan.com</a>.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
