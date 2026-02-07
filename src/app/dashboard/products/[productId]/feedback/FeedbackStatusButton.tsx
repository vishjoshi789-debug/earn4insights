'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Eye, Inbox, ChevronDown, Loader2 } from 'lucide-react'

const STATUS_CONFIG = {
  new: {
    label: 'New',
    icon: Inbox,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  reviewed: {
    label: 'Reviewed',
    icon: Eye,
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  addressed: {
    label: 'Addressed',
    icon: CheckCircle,
    color: 'bg-green-50 text-green-700 border-green-200',
  },
} as const

type FeedbackStatus = keyof typeof STATUS_CONFIG

interface Props {
  feedbackId: string
  currentStatus: string
}

export default function FeedbackStatusButton({ feedbackId, currentStatus }: Props) {
  const [status, setStatus] = useState<FeedbackStatus>(
    (currentStatus as FeedbackStatus) || 'new'
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new
  const Icon = config.icon

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (newStatus === status) return
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/dashboard/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setStatus(newStatus)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2" disabled={isUpdating}>
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Icon className="w-3 h-3" />
          )}
          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
            {config.label}
          </Badge>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.entries(STATUS_CONFIG) as [FeedbackStatus, (typeof STATUS_CONFIG)[FeedbackStatus]][]).map(
          ([key, val]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleStatusChange(key)}
              className={status === key ? 'bg-muted' : ''}
            >
              <val.icon className="w-4 h-4 mr-2" />
              {val.label}
              {status === key && <span className="ml-auto text-xs text-muted-foreground">current</span>}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
