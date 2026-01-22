'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { SurveyResponse } from '@/lib/survey-types'
import { exportResponsesToCSV } from '@/server/surveys/responseService'

type ExportResponsesButtonProps = {
  surveyId: string
  responses: SurveyResponse[]
}

export default function ExportResponsesButton({ surveyId, responses }: ExportResponsesButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const csv = await exportResponsesToCSV(surveyId)
      
      // Create a blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `survey-responses-${surveyId}-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export responses. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button 
      onClick={handleExport} 
      disabled={isExporting || responses.length === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      {isExporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  )
}
