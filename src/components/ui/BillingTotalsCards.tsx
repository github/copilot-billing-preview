import { appLinks } from '../../config/links'
import type { IndividualPlanUpgradeRecommendation } from '../../utils/individualPlanUpgrade'
import { formatAic, formatUsd } from '../../utils/format'
import { NegotiatedDiscountDisclaimer } from './NegotiatedDiscountDisclaimer'
import { PromotionalDataDisclaimer } from './PromotionalDataDisclaimer'

export type BillingTotalsCardsProps = {
  pruNetAmount: number
  pruGrossAmount: number
  pruDiscountAmount: number
  pruQuantity: number
  aicNetAmount: number
  aicGrossAmount: number
  aicDiscountAmount: number
  aicQuantity: number
  licenseAmount?: number
  licenseSeatCounts?: {
    business: number
    enterprise: number
  }
  showNegotiatedDiscountDisclaimer?: boolean
  showPromotionalDataDisclaimer?: boolean
  upgradeRecommendation?: IndividualPlanUpgradeRecommendation | null
  className?: string
}

export function BillingTotalsCards({
  pruNetAmount,
  pruGrossAmount,
  pruDiscountAmount,
  pruQuantity,
  aicNetAmount,
  aicGrossAmount,
  aicDiscountAmount,
  aicQuantity,
  licenseAmount,
  licenseSeatCounts,
  showNegotiatedDiscountDisclaimer = false,
  showPromotionalDataDisclaimer = false,
  upgradeRecommendation = null,
  className = '',
}: BillingTotalsCardsProps) {
  const pruTotalAmount = pruNetAmount + (licenseAmount ?? 0)
  const aicTotalAmount = aicNetAmount + (licenseAmount ?? 0)

  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()}>
      {upgradeRecommendation && (
        <p className="m-0 text-base font-normal text-center text-fg-default leading-normal">
          Your current additional usage cost is <strong>{formatUsd(upgradeRecommendation.currentAdditionalUsageCostUsd)}</strong>. Upgrading to <strong>{upgradeRecommendation.nextPlanLabel}</strong> would reduce your total monthly bill by <strong>{formatUsd(upgradeRecommendation.netSavingsUsd)}</strong>. The total bill (license + additional usage) would be <strong>{formatUsd(upgradeRecommendation.upgradedTotalBillUsd)}</strong>.
          {upgradeRecommendation.nextPlanTier === 'max' && (
            <>
              {' '}
              <a
                href={appLinks.copilotMaxPlanBlog}
                className="text-fg-accent no-underline hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more about Max plan.
              </a>
            </>
          )}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-bg-default border border-border-default rounded-md px-5 py-[28px] text-center">
          <div className="text-[13px] font-medium text-fg-muted uppercase tracking-[0.5px] mb-3">Current billing (PRUs)</div>
          <div className="text-4xl font-bold leading-[1.2] text-fg-default">{formatUsd(pruTotalAmount)}</div>
          <div className="text-sm text-fg-default mt-[6px]">{pruQuantity.toLocaleString()} PRUs</div>
          <div className="text-xs text-fg-muted mt-1">1 PRU = $0.04</div>
          <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-[6px] text-left">
            <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
              <span>Consumed (PRUs)</span>
              <span>{formatUsd(pruGrossAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
              <span>Included PRUs</span>
              <span>−{formatUsd(pruDiscountAmount)}</span>
            </div>
            <div className="pt-[6px] border-t border-dotted border-border-muted flex flex-col gap-[6px]">
              <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                <span>Overages</span>
                <span>{formatUsd(pruNetAmount)}</span>
              </div>
              {licenseAmount !== undefined && (
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>License cost</span>
                  <span>{formatUsd(licenseAmount)}</span>
                </div>
              )}
              {(licenseAmount !== undefined || showNegotiatedDiscountDisclaimer) && (
                <div className="pt-[6px] border-t border-border-default">
                  {licenseAmount !== undefined && (
                    <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums font-semibold">
                      <span>Total (license + overages)</span>
                      <span>{formatUsd(pruTotalAmount)}</span>
                    </div>
                  )}
                  {showNegotiatedDiscountDisclaimer && <NegotiatedDiscountDisclaimer />}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-bg-default border border-border-default rounded-md px-5 py-[28px] text-center">
          <div className="text-[13px] font-medium text-fg-muted uppercase tracking-[0.5px] mb-3">Usage-based billing (AICs)</div>
          <div className="text-4xl font-bold leading-[1.2] text-app-savings-fg">{formatUsd(aicTotalAmount)}</div>
          <div className="text-sm text-fg-default mt-[6px]">{formatAic(aicQuantity)} AICs</div>
          <div className="text-xs text-fg-muted mt-1">1 AIC = $0.01</div>
          <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-[6px] text-left">
            <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
              <span>Consumed (AICs)</span>
              <span>{formatUsd(aicGrossAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
              <span>Included AICs</span>
              <span>−{formatUsd(aicDiscountAmount)}</span>
            </div>
            <div className="pt-[6px] border-t border-dotted border-border-muted flex flex-col gap-[6px]">
              <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                <span>Additional usage</span>
                <span>{formatUsd(aicNetAmount)}</span>
              </div>
              {licenseAmount !== undefined && (
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>License cost</span>
                  <span>{formatUsd(licenseAmount)}</span>
                </div>
              )}
              {(licenseAmount !== undefined || showNegotiatedDiscountDisclaimer || showPromotionalDataDisclaimer) && (
                <div className="pt-[6px] border-t border-border-default">
                  {licenseAmount !== undefined && (
                    <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums font-semibold">
                      <span>Total (license + additional usage)</span>
                      <span>{formatUsd(aicTotalAmount)}</span>
                    </div>
                  )}
                  {showNegotiatedDiscountDisclaimer && (
                    <>
                      <NegotiatedDiscountDisclaimer />
                      <PromotionalDataDisclaimer scope="organization" />
                    </>
                  )}
                  {showPromotionalDataDisclaimer && <PromotionalDataDisclaimer />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {licenseSeatCounts && (
        <p className="m-0 text-[13px] text-fg-muted leading-normal text-center">
          This estimate uses <strong className="text-fg-default">{licenseSeatCounts.business.toLocaleString()}</strong> Copilot Business and{' '}
          <strong className="text-fg-default">{licenseSeatCounts.enterprise.toLocaleString()}</strong> Copilot Enterprise users. If you have more users with these licenses that are missing from the report, you can adjust counters in the <strong className="text-fg-default">Users</strong> section of this app.
        </p>
      )}
    </div>
  )
}
