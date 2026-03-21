'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">Print or Save as PDF</span>
      <span className="sm:hidden">Save PDF</span>
    </Button>
  )
}
