function formatUsd(n: number): string {
  return `$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type BillingComparisonCardProps = {
  title: string
  currentLabel: string
  currentValue: number
  aicLabel: string
  aicValue: number
  savingsText: string
  overspendText: string
  equalText?: string
}

export function BillingComparisonCard({
  title,
  currentLabel,
  currentValue,
  aicLabel,
  aicValue,
  savingsText,
  overspendText,
  equalText = 'AIC and PRU billing are equal',
}: BillingComparisonCardProps) {
  const diff = aicValue - currentValue
  const absDiff = Math.abs(diff)
  const pctChange = currentValue !== 0 ? (diff / currentValue) * 100 : 0
  const aicCheaper = diff < 0
  const same = Math.abs(diff) < 0.01

  return (
    <div className="billing-comparison">
      <h4 className="billing-comparison__title">{title}</h4>
      <div className="billing-comparison__rows">
        <div className="billing-comparison__row">
          <span className="billing-comparison__label">{currentLabel}</span>
          <span className="billing-comparison__value">{formatUsd(currentValue)}</span>
        </div>
        <div className="billing-comparison__row">
          <span className="billing-comparison__label">{aicLabel}</span>
          <span className="billing-comparison__value">{formatUsd(aicValue)}</span>
        </div>
        <div className="billing-comparison__divider" />
        <div className="billing-comparison__row">
          <span className="billing-comparison__label">Difference</span>
          <span className={`billing-comparison__value ${same ? '' : aicCheaper ? 'billing-comparison__value--savings' : 'billing-comparison__value--overspend'}`}>
            {same ? formatUsd(0) : `${aicCheaper ? '−' : '+'}${formatUsd(absDiff)}`}
            {!same && currentValue !== 0 && (
              <span className="billing-comparison__pct">
                {` (${Math.abs(pctChange).toFixed(1)}%)`}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className={`billing-comparison__verdict ${same ? 'billing-comparison__verdict--neutral' : aicCheaper ? 'billing-comparison__verdict--savings' : 'billing-comparison__verdict--overspend'}`}>
        <svg className="billing-comparison__verdict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {same ? (
            <><line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></>
          ) : aicCheaper ? (
            <><polyline points="6 9 12 15 18 9" /></>
          ) : (
            <><polyline points="6 15 12 9 18 15" /></>
          )}
        </svg>
        <span className="billing-comparison__verdict-text">
          {same ? equalText : aicCheaper ? savingsText : overspendText}
        </span>
      </div>
    </div>
  )
}
