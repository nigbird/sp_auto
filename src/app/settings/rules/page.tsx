
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gavel, PlusCircle, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Rule = {
  id: string;
  status: string;
  description: string;
  min: number;
  max: number;
  isSystem: boolean;
};

const initialRules: Rule[] = [
  { id: "1", status: "Completed As Per Target", description: "Performance against target is >= 100%", min: 100, max: Infinity, isSystem: true },
  { id: "2", status: "On Track", description: "Performance against target is from 70% up to 99.99%", min: 70, max: 99.99, isSystem: false },
  { id: "3", status: "Delayed", description: "Performance against target is above 0% but less than 70%", min: 0.01, max: 69.99, isSystem: false },
  { id: "4", status: "Not Started", description: "Performance against target is 0%", min: 0, max: 0, isSystem: true },
];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedRule, setEditedRule] = useState<Partial<Rule> | null>(null);
  const { toast } = useToast();

  const handleEditClick = (rule: Rule) => {
    setEditingId(rule.id);
    setEditedRule({ ...rule });
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedRule(null);
  };

  const handleSaveEdit = () => {
    if (!editedRule || !editingId) return;

    setRules(rules.map(rule => rule.id === editingId ? { ...rule, ...editedRule } as Rule : rule));
    setEditingId(null);
    setEditedRule(null);
    toast({
      title: "Rule Updated",
      description: `The rule "${editedRule.status}" has been successfully updated.`,
    });
  };

  const handleRuleChange = (field: keyof Omit<Rule, "id" | "isSystem">, value: string | number) => {
    if (!editedRule) return;
    setEditedRule({ ...editedRule, [field]: value });
  };

  const handleAddRule = () => {
    const newId = `rule-${Date.now()}`;
    const newRule: Rule = { 
        id: newId, 
        status: "New Status", 
        description: "New status description", 
        min: 0, 
        max: 0, 
        isSystem: false 
    };
    setRules([...rules, newRule]);
    handleEditClick(newRule);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
    toast({
        title: "Rule Deleted",
        description: "The selected rule has been deleted.",
        variant: "destructive",
    })
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
      <div className="flex items-center justify-between gap-4">
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
        <Button onClick={handleAddRule}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Status
        </Button>
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
                <TableHead className="w-[20%]">Activity Status</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead className="w-[10%] text-center">From (%)</TableHead>
                <TableHead className="w-[10%] text-center">To (%)</TableHead>
                <TableHead className="w-[15%] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                return (
                    <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                            {isEditing ? (
                                <Input value={editedRule?.status || ''} onChange={(e) => handleRuleChange('status', e.target.value)} />
                            ) : (
                                rule.status
                            )}
                        </TableCell>
                        <TableCell>
                            {isEditing ? (
                                <Input value={editedRule?.description || ''} onChange={(e) => handleRuleChange('description', e.target.value)} />
                            ) : (
                                rule.description
                            )}
                        </TableCell>
                        <TableCell>
                            <Input 
                                type="number" 
                                value={isEditing ? editedRule?.min : rule.min}
                                onChange={(e) => handleRuleChange('min', parseFloat(e.target.value))}
                                className="text-center"
                                disabled={!isEditing && rule.isSystem}
                                readOnly={!isEditing}
                            />
                        </TableCell>
                        <TableCell>
                            <Input 
                                type="number" 
                                value={isEditing && editedRule && isFinite(editedRule.max as number) ? editedRule.max : isFinite(rule.max) ? rule.max : ""}
                                onChange={(e) => handleRuleChange('max', parseFloat(e.target.value))}
                                placeholder={isFinite(rule.max) ? "" : "Infinity"}
                                className="text-center"
                                disabled={!isEditing && rule.isSystem}
                                readOnly={!isEditing}
                            />
                        </TableCell>
                        <TableCell className="text-center">
                            {rule.isSystem ? (
                                <span className="text-xs text-muted-foreground">System Rule</span>
                            ) : isEditing ? (
                                <div className="flex justify-center gap-2">
                                    <Button size="icon" variant="ghost" onClick={handleSaveEdit}><Save className="h-4 w-4 text-green-600"/></Button>
                                    <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4 text-red-600"/></Button>
                                </div>
                            ) : (
                                <div className="flex justify-center gap-2">
                                    <Button size="icon" variant="ghost" onClick={() => handleEditClick(rule)}><Edit className="h-4 w-4"/></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteRule(rule.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            )}
                        </TableCell>
                    </TableRow>
                )
              })}
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
