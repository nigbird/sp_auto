"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { publishStrategicPlan } from "@/actions/strategic-plan";
import { CheckCircle, Loader2 } from "lucide-react";

export function PublishButton({ planId }: { planId: string }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishStrategicPlan(planId);
      toast({ title: "Plan Published", description: "The strategic plan is now live." });
      router.refresh();
    } catch (error) {
      toast({
        title: "Could Not Publish Plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Button onClick={handlePublish} disabled={isPublishing}>
      {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
      Publish
    </Button>
  );
}
