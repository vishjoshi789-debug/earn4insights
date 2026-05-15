'use client'

import { cn } from '@/lib/utils'
import { ChatMarkdown } from './markdown'

export type BubbleRole = 'user' | 'assistant' | 'system'

export function ChatBubble({
  role,
  content,
  timestamp,
}: {
  role: BubbleRole
  content: string
  timestamp?: string
}) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  if (role === 'system') {
    return (
      <div className="flex justify-center px-2">
        <div className="text-[11px] text-muted-foreground italic" title={time}>
          {content}
        </div>
      </div>
    )
  }

  const isUser = role === 'user'
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'group relative max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <ChatMarkdown text={content} />
        )}
        {time && (
          <span
            className={cn(
              'pointer-events-none absolute -bottom-4 text-[10px] opacity-0 transition-opacity group-hover:opacity-60',
              isUser ? 'right-1' : 'left-1'
            )}
          >
            {time}
          </span>
        )}
      </div>
    </div>
  )
}

/** Three-dot typing indicator. */
export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
