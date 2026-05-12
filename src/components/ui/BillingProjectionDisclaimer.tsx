import { InfoIcon } from '@primer/octicons-react'

type BillingProjectionDisclaimerProps = {
  className?: string
}

export function BillingProjectionDisclaimer({ className = '' }: BillingProjectionDisclaimerProps) {
  return (
    <div
      className={`flex items-start gap-[10px] rounded-md border border-border-accent/25 bg-bg-accent-muted px-4 py-3 text-sm text-fg-default ${className}`.trim()}
      role="note"
    >
      <InfoIcon size={16} className="fill-fg-accent shrink-0 mt-0.5" aria-hidden />
      <span>
        Estimated projection for illustrative purposes only. Actual usage may differ.
        <br />
        Charges are calculated from actual usage emissions processed by the billing platform, separate from the preview
        data pipeline. Possible gaps are a reporting issue, not a billing issue.
      </span>
    </div>
  )
}
