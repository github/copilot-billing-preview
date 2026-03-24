import type { OrganizationResult } from '../pipeline/aggregators/organizationAggregator'

function formatUsd(n: number): string {
  return `$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatAiu(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

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

      <div className="orgs-view__tableWrap">
        <table className="orgs-view__table">
          <thead>
            <tr>
              <th>Organization</th>
              <th className="orgs-view__num">Users</th>
              <th className="orgs-view__num">Models</th>
              <th className="orgs-view__num">AI Credits</th>
              <th className="orgs-view__num">Gross Cost</th>
              <th className="orgs-view__num">Discounts</th>
              <th className="orgs-view__num">Net Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.organizations.map((organization) => (
              <tr key={organization.organization}>
                <td className="orgs-view__name">{organization.organization}</td>
                <td className="orgs-view__num">{organization.userCount.toLocaleString()}</td>
                <td className="orgs-view__num">{organization.modelCount.toLocaleString()}</td>
                <td className="orgs-view__num">{formatAiu(organization.aiuQuantity)}</td>
                <td className="orgs-view__num">{formatUsd(organization.grossAmount)}</td>
                <td className="orgs-view__num">{formatUsd(organization.discountAmount)}</td>
                <td className="orgs-view__num">{formatUsd(organization.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
