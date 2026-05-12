import { appLinks } from '../../config/links'

type PromotionalDataDisclaimerProps = {
  scope?: 'individual' | 'organization'
  className?: string
}

export function PromotionalDataDisclaimer({
  scope = 'individual',
  className = '',
}: PromotionalDataDisclaimerProps) {
  const href = scope === 'organization'
    ? appLinks.promotionalAmountsDocs
    : appLinks.usageBasedBillingForIndividualsDocs

  return (
    <p className={`m-0 mt-1 text-[12px] text-fg-muted leading-normal ${className}`.trim()}>
      Promotional amounts are used in this simulation.{` `}
      <a
        href={href}
        className="text-fg-accent no-underline hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Learn more about promotional amounts.
      </a>
    </p>
  )
}
