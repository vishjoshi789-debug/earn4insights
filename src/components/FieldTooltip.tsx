'use client'

import { HelpCircle } from 'lucide-react'

type FieldTooltipProps = {
  content: string
}

export function FieldTooltip({ content }: FieldTooltipProps) {
  return (
    <span 
      className="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground transition-colors cursor-help group relative"
      title={content}
    >
      <HelpCircle className="w-4 h-4" />
      <span className="invisible group-hover:visible absolute left-6 top-0 z-10 w-64 p-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-md">
        {content}
      </span>
    </span>
  )
}
