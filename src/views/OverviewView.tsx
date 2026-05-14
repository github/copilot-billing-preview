import { DualAxisLineChart } from '../components'
import { BillingProjectionDisclaimer, BillingTotalsCards } from '../components/ui'
import { appLinks } from '../config/links'
import type { ReportPlanScope } from '../pipeline/aicIncludedCredits'
import type { DailyUsageData } from '../pipeline/aggregators/dailyUsageAggregator'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatUsd } from '../utils/format'
import type { IndividualPlanUpgradeRecommendation } from '../utils/individualPlanUpgrade'

type OverviewViewProps = {
  error: string | null
  fileName: string | null
  dailyUsageData: DailyUsageData[]
  rangeStart: string | null
  rangeEnd: string | null
  licenseAmount?: number
  licenseSeatCounts?: {
    business: number
    enterprise: number
  }
  reportPlanScope?: ReportPlanScope
  upgradeRecommendation?: IndividualPlanUpgradeRecommendation | null
}

function createEmptyDailyUsage(date: string): DailyUsageData {
  return {
    date,
    requests: 0,
    aicQuantity: 0,
    grossAmount: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

export function OverviewView({
  error,
  fileName,
  dailyUsageData,
  rangeStart,
  rangeEnd,
  licenseAmount,
  licenseSeatCounts,
  reportPlanScope = 'organization',
  upgradeRecommendation = null,
}: OverviewViewProps) {
  const filledDailyUsageData = fillDataForRange(dailyUsageData, rangeStart, rangeEnd, createEmptyDailyUsage)

  const overviewTotals = dailyUsageData.reduce(
    (totals, day) => {
      totals.requests += day.requests
      totals.aicQuantity += day.aicQuantity
      totals.grossAmount += day.grossAmount
      totals.aicGrossAmount += day.aicGrossAmount
      totals.aicNetAmount += day.aicNetAmount
      totals.discountAmount += day.discountAmount
      totals.netAmount += day.netAmount
      return totals
    },
    { requests: 0, aicQuantity: 0, grossAmount: 0, aicGrossAmount: 0, aicNetAmount: 0, discountAmount: 0, netAmount: 0 },
  )

  const aicNetAmount = overviewTotals.aicNetAmount
  const aicDiscount = Math.max(overviewTotals.aicGrossAmount - aicNetAmount, 0)
  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null
  const savings = overviewTotals.netAmount - aicNetAmount
  const usageBasedBillingDocsUrl = reportPlanScope === 'individual'
    ? appLinks.usageBasedBillingForIndividualsDocs
    : appLinks.usageBasedBillingForOrganizationsDocs

  return (
    <div className="max-w-[var(--width-content-max)] w-full mx-auto px-6 pt-8 pb-12 flex flex-col gap-6">
      <section className="flex gap-4 flex-wrap" aria-live="polite">
        {error && (
          <div className="py-3 px-4 rounded-md bg-bg-danger-muted text-fg-danger border border-border-danger text-sm" role="status">
            <span>⚠️ {error}</span>
          </div>
        )}
      </section>

      {dailyUsageData.length > 0 && (
        <section>
          <div className="bg-bg-accent-muted border border-border-accent/25 rounded-md py-5 px-6 mb-5 flex flex-col gap-2">
            <h2 className="m-0 text-base font-semibold text-fg-default">GitHub Copilot is moving to usage-based billing</h2>
            <p className="m-0 text-sm text-fg-default leading-normal">
              Starting June 1, 2026, Copilot usage will be measured in AI Credits (AICs) instead of Premium Requests (PRUs). <strong className="text-[15px] font-bold bg-bg-default py-[2px] px-2 rounded-[4px] whitespace-nowrap">1 AIC = $0.01.</strong> This is a preview estimate based on your uploaded report. Actual bills under usage-based billing may differ based on model mix and final pricing.
            </p>
            {fileName && (
              <p className="m-0 text-[13px] text-fg-muted leading-normal">
                Note: This is a preview estimate based on your uploaded report ({fileName}). Actual bills under usage-based billing may differ based on model mix and final pricing.
              </p>
            )}
            <a
              href={usageBasedBillingDocsUrl}
              className="text-sm font-medium text-fg-accent no-underline self-start hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about usage-based billing &rarr;
            </a>
          </div>

          {periodLabel && (
            <p className="text-base font-normal text-center mb-1 text-fg-default">
              {savings > 0 ? (
                <>
                  Your <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under usage-based billing
                </>
              ) : savings < 0 ? (
                <>
                  Your <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under usage-based billing
                </>
              ) : (
                <>
                  Your <strong>{periodLabel}</strong> usage cost would be the same under usage-based billing
                </>
              )}
            </p>
          )}

          <BillingTotalsCards
            pruNetAmount={overviewTotals.netAmount}
            pruGrossAmount={overviewTotals.grossAmount}
            pruDiscountAmount={overviewTotals.discountAmount}
            pruQuantity={overviewTotals.requests}
            aicNetAmount={aicNetAmount}
            aicGrossAmount={overviewTotals.aicGrossAmount}
            aicDiscountAmount={aicDiscount}
            aicQuantity={overviewTotals.aicQuantity}
            licenseAmount={licenseAmount}
            licenseSeatCounts={licenseSeatCounts}
            showNegotiatedDiscountDisclaimer={reportPlanScope !== 'individual'}
            showPromotionalDataDisclaimer={reportPlanScope === 'individual'}
            upgradeRecommendation={upgradeRecommendation}
            className="mb-3"
          />
          <BillingProjectionDisclaimer className="mb-6" />

          <section className="grid grid-cols-1 gap-6 w-full">
            <DualAxisLineChart
              title="Daily Requests & AI Credits"
              labels={filledDailyUsageData.map((day) => day.date)}
              series={[
                {
                  label: 'Premium Requests',
                  color: '#6366f1',
                  data: filledDailyUsageData.map((day) => day.requests),
                  yAxisID: 'y',
                },
                {
                  label: 'AI Credits',
                  color: '#22c55e',
                  data: filledDailyUsageData.map((day) => day.aicQuantity),
                  yAxisID: 'y1',
                },
              ]}
              height={320}
            />
            <DualAxisLineChart
              title="Daily cost: PRU cost vs AIC cost"
              labels={filledDailyUsageData.map((day) => day.date)}
              series={[
                {
                  label: 'PRU Gross Cost',
                  color: '#cf222e',
                  data: filledDailyUsageData.map((day) => day.grossAmount),
                  yAxisID: 'y',
                },
                {
                  label: 'AIC Gross Cost',
                  color: '#54aeff',
                  data: filledDailyUsageData.map((day) => day.aicGrossAmount),
                  yAxisID: 'y',
                },
              ]}
              formatYAsCurrency
              height={320}
            />
            <DualAxisLineChart
              title="Cumulative net cost: PRU vs AIC"
              labels={filledDailyUsageData.map((day) => day.date)}
              series={[
                {
                  label: 'PRU Net Cost',
                  color: '#cf222e',
                  data: filledDailyUsageData.reduce<number[]>((acc, day) => {
                    acc.push((acc[acc.length - 1] ?? 0) + day.netAmount)
                    return acc
                  }, []),
                  yAxisID: 'y',
                },
                {
                  label: 'AIC Net Cost',
                  color: '#54aeff',
                  data: filledDailyUsageData.reduce<number[]>((acc, day) => {
                    acc.push((acc[acc.length - 1] ?? 0) + day.aicNetAmount)
                    return acc
                  }, []),
                  yAxisID: 'y',
                },
              ]}
              formatYAsCurrency
              height={320}
            />
          </section>

          {reportPlanScope === 'organization' && (
            <div className="bg-bg-default border border-border-default rounded-md py-5 px-6 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex-1 flex flex-col gap-1">
                <strong className="text-sm font-semibold text-fg-default">Pooled included credits are coming</strong>
                <p className="m-0 text-[13px] text-fg-muted leading-normal">
                  Under usage-based billing, included credits will be pooled across all licensed users in your account. No more unused capacity going to waste from idle users.
                </p>
              </div>
              <a
                href={appLinks.aiCreditsForOrganizationsDocs}
                className="text-sm font-medium text-fg-accent no-underline whitespace-nowrap hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more &rarr;
              </a>
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-base font-semibold text-fg-default pb-[10px] border-b border-border-default mb-4">Recommended next steps</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 [&>:last-child]:col-span-full">
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 flex flex-col gap-[6px]">
                <h3 className="m-0 text-sm font-semibold text-fg-default">Set an account-level budget</h3>
                <p className="m-0 text-[13px] text-fg-muted leading-normal flex-1">Control your total Copilot costs and prevent additional spend across your account. A top-level budget ensures spending stays within the limits you set.</p>
                <a href={appLinks.newBillingBudget} className="inline-block mt-2 text-[13px] font-semibold text-fg-on-emphasis no-underline self-start bg-bg-success-emphasis rounded-md py-2 px-4 hover:bg-app-savings-fg hover:no-underline" target="_blank" rel="noopener noreferrer">Set account budget &rarr;</a>
              </div>
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 flex flex-col gap-[6px]">
                <h3 className="m-0 text-sm font-semibold text-fg-default">Set per-user budgets</h3>
                <p className="m-0 text-[13px] text-fg-muted leading-normal flex-1">Ensure every user gets the access they need while you control how included credits are distributed. User-level budgets prevent any single person from consuming an outsized share of the pool.</p>
                <a href={appLinks.billingBudgets} className="inline-block mt-2 text-[13px] font-medium text-fg-accent no-underline self-start hover:underline" target="_blank" rel="noopener noreferrer">Manage user budgets &rarr;</a>
              </div>
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 flex flex-col gap-[6px]">
                <h3 className="m-0 text-sm font-semibold text-fg-default">Set product-level budgets</h3>
                <p className="m-0 text-[13px] text-fg-muted leading-normal flex-1">Your usage breakdown shows cost by product. Set budgets per product (e.g., Copilot Cloud Agent, Copilot Chat) to control spending where it matters most.</p>
                <a href={appLinks.billingBudgets} className="inline-block mt-2 text-[13px] font-medium text-fg-accent no-underline self-start hover:underline" target="_blank" rel="noopener noreferrer">Set product budgets &rarr;</a>
              </div>
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 flex flex-col gap-[6px]">
                <h3 className="m-0 text-sm font-semibold text-fg-default">Read the docs</h3>
                <p className="m-0 text-[13px] text-fg-muted leading-normal flex-1">Learn how usage-based billing works and how to plan for the transition.</p>
                <a href={appLinks.billingDocs} className="inline-block mt-2 text-[13px] font-medium text-fg-accent no-underline self-start hover:underline" target="_blank" rel="noopener noreferrer">View documentation &rarr;</a>
              </div>
            </div>
          </section>
        </section>
      )}
    </div>
  )
}
