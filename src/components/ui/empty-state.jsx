import * as React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

function EmptyState({ icon, title, description, action, className, ...props }) {
  const Icon = icon ?? Inbox
  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">
        <Icon size={20} className="shrink-0" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h3>
        {description && (
          <p className="mx-auto max-w-xs text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
