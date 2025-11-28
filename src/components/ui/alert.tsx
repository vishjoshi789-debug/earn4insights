"use client";

import * as React from "react";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export function Alert({ variant = "default", className, ...props }: AlertProps) {
  const base =
    "relative w-full rounded-lg border px-4 py-3 text-sm flex gap-2 items-start";
  const variantClass =
    variant === "destructive"
      ? "border-red-400 bg-red-50 text-red-900"
      : "border-gray-300 bg-white text-gray-900";

  return (
    <div className={[base, variantClass, className].filter(Boolean).join(" ")} {...props} />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={["font-semibold leading-none tracking-tight", className]
        .filter(Boolean)
        .join(" ")}
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
      className={["text-sm text-gray-700 mt-1", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

// Optional default export (not strictly required, but harmless)
const AlertModule = { Alert, AlertTitle, AlertDescription };
export default AlertModule;
