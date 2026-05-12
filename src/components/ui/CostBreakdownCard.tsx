import type { ReactNode } from 'react'

export interface CostBreakdownItem {
  label: string
  value: ReactNode
  variant?: 'default' | 'muted' | 'highlight'
}

export interface CostBreakdownCardProps {
  title?: string
  items: CostBreakdownItem[]
}

export function CostBreakdownCard({ title, items }: CostBreakdownCardProps) {
  return (
    <div className="bg-bg-muted border border-border-default rounded-md px-4 py-3 flex flex-col gap-2 min-w-[220px] max-w-[300px]">
      {title && <h4 className="m-0 mb-1 text-xs font-bold text-fg-muted uppercase tracking-wider">{title}</h4>}
      {items.map((item, index) => {
        const isHighlight = item.variant === 'highlight'
        const isMuted = item.variant === 'muted'
        
        return (
          <div
            key={index}
            className={`flex justify-between items-center gap-4 ${isHighlight ? 'pt-2 border-t border-border-default' : ''}`}
          >
            <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{item.label}</span>
            <span
              className={`tabular-nums ${
                isMuted
                  ? 'text-sm font-semibold text-fg-muted'
                  : isHighlight
                    ? 'text-[15px] font-bold text-app-accent'
                    : 'text-sm font-semibold text-fg-default'
              }`}
            >
              {item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
