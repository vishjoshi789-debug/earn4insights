"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

type AccordionContextValue = {
  type: "single" | "multiple"
  openItems: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

type AccordionProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: "single" | "multiple"
  defaultValue?: string | string[]
}

export function Accordion({ type = "single", defaultValue, children, className, ...rest }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
    if (!defaultValue) return new Set<string>()
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue])
  })

  const toggle = React.useCallback((value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        if (type === "single") next.clear()
        next.add(value)
      }
      return next
    })
  }, [type])

  const ctx = React.useMemo(() => ({ type, openItems, toggle }), [type, openItems, toggle])

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={className} {...rest}>{children}</div>
    </AccordionContext.Provider>
  )
}

const AccordionItemContext = React.createContext<string>("")

type AccordionItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string
}

export function AccordionItem({ value, children, className, ...rest }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={className ?? "border-b"} {...rest}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

type AccordionTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function AccordionTrigger({ children, className, onClick, ...rest }: AccordionTriggerProps) {
  const ctx = React.useContext(AccordionContext)
  const value = React.useContext(AccordionItemContext)
  const isOpen = ctx?.openItems.has(value) ?? false

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between font-medium transition-all ${className ?? "py-4 hover:underline"}`}
      onClick={(e) => {
        onClick?.(e)
        ctx?.toggle(value)
      }}
      {...rest}
    >
      {children}
      <ChevronDown
        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  )
}

type AccordionContentProps = React.HTMLAttributes<HTMLDivElement>

export function AccordionContent({ children, className, ...rest }: AccordionContentProps) {
  const ctx = React.useContext(AccordionContext)
  const value = React.useContext(AccordionItemContext)
  const isOpen = ctx?.openItems.has(value) ?? false

  if (!isOpen) return null

  return (
    <div className={`overflow-hidden text-sm ${className ?? "pb-4 pt-0"}`} {...rest}>
      {children}
    </div>
  )
}
