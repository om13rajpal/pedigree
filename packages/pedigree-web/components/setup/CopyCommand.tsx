'use client'

import * as React from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyCommandProps {
  command: string
  label?: string
  className?: string
}

export function CopyCommand({ command, label, className }: CopyCommandProps) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={cn('group relative', className)}>
      {label && (
        <span className="mb-1.5 block text-2xs font-medium text-neutral-400 dark:text-neutral-500">
          {label}
        </span>
      )}
      <div className="flex items-center rounded-lg border border-neutral-200/60 bg-neutral-950 dark:border-neutral-700/60">
        <pre className="flex-1 whitespace-pre-wrap break-all px-4 py-3 font-mono text-xs text-emerald-400">
          <code>{command}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy command"
          className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
