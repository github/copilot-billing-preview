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
    <div className="cost-breakdown-card">
      {title && <h4 className="cost-breakdown-card__title">{title}</h4>}
      {items.map((item, index) => {
        const isHighlight = item.variant === 'highlight'
        const isMuted = item.variant === 'muted'
        
        return (
          <div
            key={index}
            className={`cost-breakdown-card__row ${isHighlight ? 'cost-breakdown-card__row--highlight' : ''}`}
          >
            <span className="cost-breakdown-card__label">{item.label}</span>
            <span
              className={`cost-breakdown-card__value ${
                isMuted
                  ? 'cost-breakdown-card__value--muted'
                  : isHighlight
                    ? 'cost-breakdown-card__value--bold'
                    : ''
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
