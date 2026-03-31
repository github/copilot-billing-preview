import type { OrganizationResult } from '../pipeline/aggregators/organizationAggregator'
import { formatAic, formatDifference, formatUsd } from '../utils/format'
import { calculateSavingsDifference } from '../utils/billingComparison'

export function OrganizationsView({ data }: { data: OrganizationResult }) {
  if (data.organizations.length === 0) {
    return (
      <section className="orgs-view">
        <h2 className="orgs-view__heading">Organizations</h2>
        <div className="orgs-view__empty">No organizations found in this report.</div>
      </section>
    )
  }

  return (
    <section className="orgs-view">
      <div className="orgs-view__toolbar">
        <div className="orgs-view__title">
          <h2 className="orgs-view__heading">Organizations</h2>
          <span className="orgs-view__count">{data.organizations.length.toLocaleString()} total</span>
        </div>
      </div>

      <div className="orgs-view__tableWrap data-table-wrap">
        <table className="orgs-view__table data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th className="orgs-view__num">Users</th>
              <th className="orgs-view__num">Requests</th>
              <th className="orgs-view__num">AI Credits</th>
              <th className="orgs-view__num">Net Cost (PRU)</th>
              <th className="orgs-view__num">Net Cost (AIC)</th>
              <th className="orgs-view__num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {data.organizations.map((organization) => {
              const difference = calculateSavingsDifference(organization.netAmount, organization.aicNetAmount)

              return (
                <tr key={organization.organization}>
                  <td className="orgs-view__name">{organization.organization}</td>
                  <td className="orgs-view__num">{organization.userCount.toLocaleString()}</td>
                  <td className="orgs-view__num">{organization.requests.toLocaleString()}</td>
                  <td className="orgs-view__num">{formatAic(organization.aicQuantity)}</td>
                  <td className="orgs-view__num">{formatUsd(organization.netAmount)}</td>
                  <td className="orgs-view__num">{formatUsd(organization.aicNetAmount)}</td>
                  <td
                    className={`orgs-view__num ${difference > 0 ? 'orgs-view__diff--positive' : difference < 0 ? 'orgs-view__diff--negative' : 'orgs-view__diff--neutral'}`}
                  >
                    {formatDifference(difference)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
