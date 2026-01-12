import type { ReactNode } from 'react'

interface BaseSummaryCardProps {
  label: string
  value: ReactNode
}

interface StaticSummaryCardProps extends BaseSummaryCardProps {
  clickable?: false
}

interface ClickableSummaryCardProps extends BaseSummaryCardProps {
  clickable: true
  onClick: () => void
  disabled?: boolean
}

export type SummaryCardProps = StaticSummaryCardProps | ClickableSummaryCardProps

export function SummaryCard(props: SummaryCardProps) {
  const { label, value, clickable } = props

  if (clickable) {
    const { onClick, disabled } = props
    return (
      <button
        type="button"
        className="summary-card summary-card--clickable"
        disabled={disabled}
        onClick={onClick}
      >
        <div className="summary-card__content">
          <span className="summary-card__label">{label}</span>
          <span className="summary-card__value">{value}</span>
        </div>
        <span className="summary-card__chevron" aria-hidden>
          &gt;
        </span>
      </button>
    )
  }

  return (
    <div className="summary-card">
      <span className="summary-card__label">{label}</span>
      <span className="summary-card__value">{value}</span>
    </div>
  )
}
