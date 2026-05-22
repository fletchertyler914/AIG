'use client'

import { ToolCallArgsEditor } from '@/components/intent/tool-call-args-editor'
import type { ToolCallDto } from '@/components/intent/types'
import { ToolCallStatusBadge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatToolActionTitle, formatToolMetaLine } from '@/lib/display/toolkits'

interface ToolCallCardProps {
  toolCall: ToolCallDto
  onChanged: () => Promise<void>
}

/** Standalone tool call card — used outside the intent detail workspace when needed. */
export function ToolCallCard({ toolCall, onChanged }: ToolCallCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm" data-testid="tool-call-name">
              {formatToolActionTitle(toolCall.tool)}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatToolMetaLine(toolCall.tool, { version: true })}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              depends on:{' '}
              {toolCall.dependsOn.length > 0 ? (
                <span className="font-mono text-foreground/80">
                  {toolCall.dependsOn.join(', ')}
                </span>
              ) : (
                <span className="font-mono">none</span>
              )}
            </p>
          </div>
          <ToolCallStatusBadge status={toolCall.status} data-testid="tool-call-status" />
        </div>
        <ToolCallArgsEditor toolCall={toolCall} onChanged={onChanged} />
      </CardContent>
    </Card>
  )
}
