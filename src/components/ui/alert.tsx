"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export function Alert({ variant = "default", className, ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "relative w-full rounded-lg border px-4 py-3 text-sm flex gap-2 items-start",
        variant === "destructive"
          ? "border-red-500/50 bg-red-900/30 text-red-200"
          : "border-slate-700 bg-slate-900/80 text-slate-200",
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-slate-400 mt-1", className)}
      {...props}
    />
  );
}

// Optional default export (not strictly required, but harmless)
const AlertModule = { Alert, AlertTitle, AlertDescription };
export default AlertModule;
