
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Rule = {
  status: string;
  description: string;
  min: number;
  max: number;
};

const initialRules: Rule[] = [
  { status: "Completed As Per Target", description: "Performance against target is >= 100%", min: 100, max: Infinity },
  { status: "On Track", description: "Performance against target is from 70% up to 99.99%", min: 70, max: 99.99 },
  { status: "Delayed", description: "Performance against target is above 0% but less than 70%", min: 0.01, max: 69.99 },
  { status: "Not Started", description: "Performance against target is 0%", min: 0, max: 0 },
];

export default function RulesPage() {
  const [rules, setRules] = useState(initialRules);
  const { toast } = useToast();

  const handleRuleChange = (index: number, field: 'min' | 'max', value: string) => {
    const newRules = [...rules];
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      newRules[index][field] = numericValue;
      setRules(newRules);
    }
  };

  const handleSaveChanges = () => {
    // In a real app, you would save these rules to a database.
    toast({
      title: "Rules Updated",
      description: "The performance status rules have been successfully updated.",
    });
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Rules</h1>
          <p className="text-muted-foreground">
            Define the criteria for how activity performance statuses are calculated.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Status Definitions</CardTitle>
          <CardDescription>
            These rules determine the status of an activity based on its progress percentage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Activity Status</TableHead>
                <TableHead>Definition (Criteria)</TableHead>
                <TableHead className="w-[15%] text-center">From (%)</TableHead>
                <TableHead className="w-[15%] text-center">To (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule, index) => (
                <TableRow key={rule.status}>
                  <TableCell className="font-medium">{rule.status}</TableCell>
                  <TableCell>{rule.description}</TableCell>
                  <TableCell>
                     <Input 
                        type="number" 
                        value={rule.min}
                        onChange={(e) => handleRuleChange(index, 'min', e.target.value)}
                        className="text-center"
                        disabled={rule.status === 'Completed As Per Target' || rule.status === 'Not Started'}
                     />
                  </TableCell>
                  <TableCell>
                     <Input 
                        type="number" 
                        value={isFinite(rule.max) ? rule.max : ""}
                        onChange={(e) => handleRuleChange(index, 'max', e.target.value)}
                        placeholder={isFinite(rule.max) ? "" : "Infinity"}
                        className="text-center"
                        disabled={rule.status === 'Completed As Per Target' || rule.status === 'Not Started'}
                     />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
            <Button onClick={handleSaveChanges}>
                <Gavel className="mr-2 h-4 w-4" /> Save Changes
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
