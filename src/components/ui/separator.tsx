import React from "react";

/**
 * Simple Separator component — exported as a named export `Separator`.
 * Adjust classes to match your design system.
 */
export function Separator(props: { className?: string }) {
  const className = props.className ?? "h-px bg-gray-200 my-4 w-full";
  return <div role="separator" className={className} />;
}

export default Separator;
