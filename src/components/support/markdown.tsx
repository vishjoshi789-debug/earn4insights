'use client'

import { Fragment } from 'react'

/**
 * Tiny markdown renderer for chatbot replies.
 *
 * Supports the subset GPT-4o-mini actually emits:
 *   **bold**, *italic*, `code`, [text](url), numbered/bulleted lists,
 *   paragraph breaks on \n\n, soft line breaks on \n.
 *
 * Avoids pulling in react-markdown (~70 KB) for the chat widget.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) out.push(text.slice(lastIdx, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${idx++}`
    if (token.startsWith('**')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      if (linkMatch) {
        out.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        out.push(token)
      }
    } else if (token.startsWith('*')) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    lastIdx = match.index + token.length
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx))
  return out
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'ul'; items: string[] }

function blockify(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let current: Block | null = null
  for (const raw of lines) {
    const line = raw.trim()
    const ol = /^(\d+)\.\s+(.*)$/.exec(line)
    const ul = /^[-*]\s+(.*)$/.exec(line)
    if (ol) {
      if (!current || current.kind !== 'ol') {
        if (current) blocks.push(current)
        current = { kind: 'ol', items: [] }
      }
      current.items.push(ol[2])
    } else if (ul) {
      if (!current || current.kind !== 'ul') {
        if (current) blocks.push(current)
        current = { kind: 'ul', items: [] }
      }
      current.items.push(ul[1])
    } else if (line === '') {
      if (current) {
        blocks.push(current)
        current = null
      }
    } else {
      if (!current || current.kind !== 'p') {
        if (current) blocks.push(current)
        current = { kind: 'p', lines: [] }
      }
      current.lines.push(raw)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = blockify(text)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          return (
            <p key={i} className="whitespace-pre-wrap break-words">
              {b.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(line, `${i}-${j}`)}
                </Fragment>
              ))}
            </p>
          )
        }
        if (b.kind === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `${i}-${j}`)}</li>
              ))}
            </ol>
          )
        }
        return (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it, `${i}-${j}`)}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
