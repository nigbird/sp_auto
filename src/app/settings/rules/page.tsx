
"use client";

import { useState, useEffect } from "react";
import { Gavel, PlusCircle, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getRules, updateRule, createRule, deleteRule } from "@/actions/rules";
import { getAppConfig, updateAchievementCap } from "@/actions/app-config";
import type { Rule } from "@/lib/types";
import { RatingBandsCard } from "@/components/settings/rating-bands-card";
import { usePermissions } from "@/components/permissions-provider";

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedRule, setEditedRule] = useState<Partial<Rule> | null>(null);
  const [achievementCap, setAchievementCap] = useState<number>(120);
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState("120");
  const { toast } = useToast();
  const canManage = usePermissions().can("settings:manage");

  useEffect(() => {
    getRules().then(setRules);
    getAppConfig().then((config) => setAchievementCap(config.achievementCapPercent));
  }, []);

  const handleEditCap = () => {
    setCapDraft(String(achievementCap));
    setIsEditingCap(true);
  };

  const handleSaveCap = async () => {
    const value = parseFloat(capDraft);
    try {
      await updateAchievementCap(value);
      setAchievementCap(value);
      setIsEditingCap(false);
      toast({ title: "Achievement Cap Updated" });
    } catch (error) {
      toast({
        title: "Could Not Update Achievement Cap",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (rule: Rule) => {
    setEditingId(rule.id);
    setEditedRule({ ...rule });
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedRule(null);
  };

  const handleSaveEdit = async () => {
    if (!editedRule || !editingId) return;

    await updateRule(editingId, {
        status: editedRule.status,
        description: editedRule.description,
        min: editedRule.min,
        max: editedRule.max,
    });
    
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

  const handleAddRule = async () => {
    const newRuleData = { 
        status: "New Status", 
        description: "New status description", 
        min: 0, 
        max: 0,
    };
    const newRule = await createRule(newRuleData);
    setRules([...rules, { ...newRule, min: 0, max: 0, isSystem: false }]);
    handleEditClick({ ...newRule, min: 0, max: 0, isSystem: false });
  };

  const handleDeleteRule = async (id: string) => {
    await deleteRule(id);
    setRules(rules.filter(rule => rule.id !== id));
    toast({
        title: "Rule Deleted",
        description: "The selected rule has been deleted.",
        variant: "destructive",
    })
  };

  const handleSaveChanges = () => {
    // This is now handled per-row, but you could have a bulk-update here
    toast({
      title: "Rules Saved",
      description: "All changes to rules have been saved.",
    });
  };

  return (
    <div className="flex-1 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Performance Rules</h2>
            <p className="text-sm text-muted-foreground">
                Define the criteria for how activity performance statuses are calculated.
            </p>
            </div>
        </div>
        {canManage && (
        <Button onClick={handleAddRule}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Status
        </Button>
        )}
      </div>
      <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Achievement Cap</CardTitle>
          <CardDescription>
            The maximum achievement percentage a KPI can be reported at, even if actual performance exceeds target.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {isEditingCap ? (
            <>
              <Input
                type="number"
                min={100}
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                className="w-32"
              />
              <span>%</span>
              <Button size="icon" variant="ghost" onClick={handleSaveCap}><Save className="h-4 w-4 text-emerald-600" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setIsEditingCap(false)}><X className="h-4 w-4 text-red-600" /></Button>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-tight text-primary">{achievementCap}%</span>
              {canManage && <Button size="icon" variant="ghost" onClick={handleEditCap}><Edit className="h-4 w-4" /></Button>}
            </>
          )}
        </CardContent>
      </Card>

      <RatingBandsCard />
      <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Status Definitions</CardTitle>
          <CardDescription>
            These rules determine the status of an activity based on its progress percentage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-[20%] text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Activity Status</TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Definition</TableHead>
                <TableHead className="h-10 w-[10%] text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">From (%)</TableHead>
                <TableHead className="h-10 w-[10%] text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">To (%)</TableHead>
                <TableHead className="h-10 w-[15%] text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                return (
                    <TableRow key={rule.id} className="border-border/50 hover:bg-muted/30">
                        <TableCell className="py-3.5 font-medium text-foreground">
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
                                disabled={!isEditing}
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
                                disabled={!isEditing}
                                readOnly={!isEditing}
                            />
                        </TableCell>
                        <TableCell className="text-center">
                            {rule.isSystem ? (
                                <span className="text-xs text-muted-foreground">System Rule</span>
                            ) : !canManage ? null : isEditing ? (
                                <div className="flex justify-center gap-2">
                                    <Button size="icon" variant="ghost" onClick={handleSaveEdit}><Save className="h-4 w-4 text-emerald-600"/></Button>
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
          </div>
        </CardContent>
        {canManage && <CardFooter className="justify-end border-t pt-6">
            <Button onClick={handleSaveChanges}>
                <Gavel className="mr-2 h-4 w-4" /> Save All Changes
            </Button>
        </CardFooter>}
      </Card>
    </div>
  );
}
