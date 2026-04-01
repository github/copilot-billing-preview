import { DualAxisLineChart } from '../components'
import type { DailyUsageData } from '../pipeline/aggregators/dailyUsageAggregator'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAic, formatUsd } from '../utils/format'

type OverviewViewProps = {
  error: string | null
  fileName: string | null
  dailyUsageData: DailyUsageData[]
  rangeStart: string | null
  rangeEnd: string | null
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

  return (
    <div className="overview-page">
      <section className="report-summary" aria-live="polite">
        {error && (
          <div className="error" role="status">
            <span>⚠️ {error}</span>
          </div>
        )}
      </section>

      {dailyUsageData.length > 0 && (
        <section>
          <div className="context-banner">
            <h2 className="context-banner__title">GitHub Copilot is moving to AI Credits-based billing</h2>
            <p className="context-banner__body">
              Starting May 1, 2026, Copilot usage will be measured in AI Credits (AICs) instead of Premium Requests (PRUs). <strong className="aic-callout">1 AIC = $0.01.</strong> This preview shows what your usage would look like under the new pricing.
            </p>
            {fileName && (
              <p className="context-banner__note">
                Note: This is a preview estimate based on your uploaded report ({fileName}). Actual bills under AI Credits-based billing may differ based on model mix and final pricing.
              </p>
            )}
            <a
              href="https://docs.github.com/billing/managing-your-copilot-usage"
              className="context-banner__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about AI Credits-based billing &rarr;
            </a>
          </div>

          {periodLabel && (
            <p className="comparison-framing">
              {savings > 0 ? (
                <>
                  Your <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under AI Credits-based billing
                </>
              ) : savings < 0 ? (
                <>
                  Your <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under AI Credits-based billing
                </>
              ) : (
                <>
                  Your <strong>{periodLabel}</strong> usage cost would be the same under AI Credits-based billing
                </>
              )}
            </p>
          )}

          <div className="comparison-grid">
            <div className="card comparison-card">
              <div className="comparison-card__label">Current billing (PRUs)</div>
              <div className="comparison-card__big-number">{formatUsd(overviewTotals.netAmount)}</div>
              <div className="comparison-card__period">{overviewTotals.requests.toLocaleString()} PRUs</div>
              <div className="comparison-card__rate">1 PRU = $0.04</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatUsd(overviewTotals.grossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Discounts</span>
                  <span>−{formatUsd(overviewTotals.discountAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatUsd(overviewTotals.netAmount)}</span>
                </div>
              </div>
            </div>
            <div className="card comparison-card">
              <div className="comparison-card__label">AI Credits-based billing (AICs)</div>
              <div className="comparison-card__big-number comparison-card__big-number--aic">{formatUsd(aicNetAmount)}</div>
              <div className="comparison-card__period">{formatAic(overviewTotals.aicQuantity)} AICs</div>
              <div className="comparison-card__rate">1 AIC = $0.01</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatUsd(overviewTotals.aicGrossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Included credits discount</span>
                  <span>−{formatUsd(aicDiscount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatUsd(aicNetAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <section className="charts-grid">
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
          </section>

          <div className="entitlement-banner">
            <div className="entitlement-banner__body">
              <strong className="entitlement-banner__title">Pooled entitlements are coming</strong>
              <p className="entitlement-banner__text">
                Under AI Credits-based billing, entitlements will be pooled across all licensed users in your organization. No more unused capacity going to waste from idle users.
              </p>
            </div>
            <a
              href="https://docs.github.com/billing/managing-your-copilot-usage"
              className="entitlement-banner__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more &rarr;
            </a>
          </div>

          <section className="next-steps">
            <h2 className="next-steps__heading">Recommended next steps</h2>
            <div className="next-steps__grid">
              <div className="next-steps__card">
                <h3 className="next-steps__card-title">Set an account-level budget</h3>
                <p className="next-steps__card-body">Control your total Copilot costs and prevent overages across your account. A top-level budget ensures spending stays within the limits you set.</p>
                <a href="https://github.com/settings/billing/budgets/new" className="next-steps__cta next-steps__cta--primary" target="_blank" rel="noopener noreferrer">Set account budget &rarr;</a>
              </div>
              <div className="next-steps__card">
                <h3 className="next-steps__card-title">Set per-user budgets</h3>
                <p className="next-steps__card-body">Ensure every user gets the access they need while you control how entitlements are distributed. User-level budgets prevent any single person from consuming an outsized share of the pool.</p>
                <a href="https://github.com/settings/billing/budgets" className="next-steps__cta" target="_blank" rel="noopener noreferrer">Manage user budgets &rarr;</a>
              </div>
              <div className="next-steps__card">
                <h3 className="next-steps__card-title">Set product-level budgets</h3>
                <p className="next-steps__card-body">Your usage breakdown shows cost by product. Set budgets per product (e.g., Copilot Cloud Agent, Copilot Chat) to control spending where it matters most.</p>
                <a href="https://github.com/settings/billing/budgets" className="next-steps__cta" target="_blank" rel="noopener noreferrer">Set product budgets &rarr;</a>
              </div>
              <div className="next-steps__card">
                <h3 className="next-steps__card-title">Read the docs</h3>
                <p className="next-steps__card-body">Learn how AI Credits-based billing works and how to plan for the transition.</p>
                <a href="https://docs.github.com/billing" className="next-steps__cta" target="_blank" rel="noopener noreferrer">View documentation &rarr;</a>
              </div>
            </div>
          </section>
        </section>
      )}
    </div>
  )
}
