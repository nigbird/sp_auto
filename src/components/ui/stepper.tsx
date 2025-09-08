
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepperProps {
  steps: {
    title: string;
    isCompleted: boolean;
    isCurrent: boolean;
  }[];
  onStepClick: (stepIndex: number) => void;
  className?: string;
}

export function Stepper({ steps, onStepClick, className }: StepperProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center w-full">
          <button
            onClick={() => step.isCompleted && onStepClick(index)}
            disabled={!step.isCompleted && !step.isCurrent}
            className="flex flex-col items-center justify-center text-center cursor-pointer disabled:cursor-not-allowed group"
          >
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors duration-300",
                step.isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : step.isCompleted
                  ? "border-primary bg-primary/20 text-primary group-hover:bg-primary/40"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {step.isCompleted && !step.isCurrent ? <Check /> : index + 1}
            </div>
            <p
              className={cn(
                "mt-2 text-sm font-medium",
                step.isCurrent ? "text-primary" : "text-muted-foreground"
              )}
            >
              {step.title}
            </p>
          </button>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 transition-colors duration-300",
                step.isCompleted ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
