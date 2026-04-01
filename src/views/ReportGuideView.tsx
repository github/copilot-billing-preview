const HEADER = [
  'date',
  'username',
  'product',
  'sku',
  'model',
  'quantity',
  'unit_type',
  'applied_cost_per_quantity',
  'gross_amount',
  'discount_amount',
  'net_amount',
  'exceeds_quota',
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
]

const SAMPLE_ROW_1 = [
  '2026-03-01',
  'mona',
  'copilot',
  'copilot_premium_request',
  'Auto: Claude Haiku 4.5',
  '0.8999999999999999',
  'requests',
  '0.04',
  '0.036000000000000004',
  '0.036000000000000004',
  '0',
  'FALSE',
  '1000',
  'octodemo',
  'Octocats',
  '3.1073950000000004',
  '0.031073950000000003',
]

const SAMPLE_ROW_2 = [
  '2026-03-11',
  'mona',
  'copilot',
  'copilot_premium_request',
  'GPT-4.1',
  '24.9364',
  'requests',
  '0',
  '0',
  '0',
  '0',
  'FALSE',
  '1000',
  'octodemo',
  'Octocats',
  '24.9364',
  '0.24936400000000003',
]

const SAMPLE_ROW_2_ANNOTATIONS: { index: number; label: string; note: string }[] = [
  {
    index: 4,
    label: 'model',
    note: '"GPT-4.1" — a Base Model with a 0× PRU Multiplier. Requests to Base Models were not included in billing reports before AI Credit based billing, but now appear because every model consumes AI Credits (AICs).',
  },
  {
    index: 5,
    label: 'quantity',
    note: '≈ 24.9 requests made to GPT-4.1 on this day.',
  },
  { index: 6, label: 'unit_type', note: '"requests" — billed in Premium Request units, but the 0× multiplier makes the PRU cost zero.' },
  {
    index: 7,
    label: 'applied_cost_per_quantity',
    note: '$0 per PRU — GPT-4.1 is a Base Model with a 0× PRU Multiplier, so no PRU cost is charged.',
  },
  {
    index: 8,
    label: 'gross_amount',
    note: '$0 gross PRU cost (24.9 requests × $0). No PRU charge applies to this Base Model.',
  },
  {
    index: 9,
    label: 'discount_amount',
    note: '$0 — there is no PRU cost to discount.',
  },
  {
    index: 15,
    label: 'aic_quantity',
    note: '≈ 24.9 AICs consumed. Under AI Credit based billing, even Base Models consume AI Credits proportional to actual token usage.',
  },
  {
    index: 16,
    label: 'aic_gross_amount',
    note: '≈ $0.249 (24.9 AICs × $0.01). This is what the same usage would cost under AI Credit based billing.',
  },
]

const SAMPLE_ROW_1_ANNOTATIONS: { index: number; label: string; note: string }[] = [
  { index: 0, label: 'date', note: 'Usage date: March 1, 2026.' },
  { index: 1, label: 'username', note: 'The GitHub user who generated the request.' },
  { index: 2, label: 'product', note: '"copilot" — the Copilot product family.' },
  { index: 3, label: 'sku', note: '"copilot_premium_request" — one Premium Request billed in PRUs (as opposed to AI Credits).' },
  {
    index: 4,
    label: 'model',
    note: '"Auto: Claude Haiku 4.5" — the user let Copilot pick the best model automatically. Auto-selection applies a 10% PRU discount.',
  },
  {
    index: 5,
    label: 'quantity',
    note: '≈ 0.9 PRUs. 1 Premium Request × 0.9 (Auto-mode 10% discount) = 0.9 PRUs.',
  },
  { index: 6, label: 'unit_type', note: '"requests" — this row is billed in Premium Requests (PRUs), not AI Credits.' },
  { index: 7, label: 'applied_cost_per_quantity', note: '$0.04 per PRU — the standard PRU rate.' },
  {
    index: 8,
    label: 'gross_amount',
    note: '$0.036 gross PRU cost (0.9 PRUs × $0.04). This is the cost before any quota-based discount.',
  },
  {
    index: 9,
    label: 'discount_amount',
    note: '$0.036 — fully covered by the user\'s monthly quota entitlement (1,000 PRUs/month), so the entire gross amount is discounted.',
  },
  {
    index: 10,
    label: 'net_amount',
    note: '$0.00 — net PRU charge after quota discount. No additional cost was incurred for this request.',
  },
  { index: 11, label: 'exceeds_quota', note: 'FALSE — usage stayed within the monthly quota.' },
  { index: 12, label: 'total_monthly_quota', note: '1,000 PRUs — the monthly PRU quota for this user\'s plan.' },
  { index: 13, label: 'organization', note: 'The GitHub organization slug: "octodemo".' },
  { index: 14, label: 'cost_center_name', note: '"Octocats" — the cost center this user is assigned to.' },
  {
    index: 15,
    label: 'aic_quantity',
    note: '≈ 3.107 AICs — the AI Credit based billing equivalent of this request. AICs represent the actual tokens consumed.',
  },
  {
    index: 16,
    label: 'aic_gross_amount',
    note: '≈ $0.031 (3.107 AICs × $0.01). Under AI Credit based billing this request would cost roughly $0.03.',
  },
]

function AnnotatedRow({ header, values, annotations }: {
  header: string[]
  values: string[]
  annotations: { index: number; label: string; note: string }[]
}) {
  return (
    <div className="report-guide__sample">
      <div className="report-guide__csv-scroll">
        <table className="report-guide__csv-table">
          <thead>
            <tr>
              {header.map((col) => (
                <th key={col} className="report-guide__csv-th">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {values.map((val, i) => (
                <td key={i} className="report-guide__csv-td">{val}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="report-guide__annotation-list">
        {annotations.map(({ index, label, note }) => (
          <div key={index} className="report-guide__annotation-row">
            <dt className="report-guide__annotation-col">
              <code className="report-guide__annotation-code">{label}</code>
              <span className="report-guide__annotation-value">{values[index]}</span>
            </dt>
            <dd className="report-guide__annotation-note">{note}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function ReportGuideView() {
  return (
    <section className="report-guide">
      <h2 className="report-guide__heading">Report Format</h2>
      <p className="report-guide__intro">
        Each row in the CSV export represents one unit of Copilot usage for a single user and model on a given day.
        Below are annotated examples showing what each field means.
      </p>

      <div className="report-guide__example">
        <h3 className="report-guide__example-title">Example: Premium Request with an Auto-selected model</h3>
        <p className="report-guide__example-summary">
          On <strong>1 March 2026</strong>, user <strong>mona</strong> made <strong>1 Premium Request</strong> using{' '}
          <strong>Claude Haiku 4.5</strong> in <strong>Auto</strong> mode. Auto-mode selection applies a 10% PRU
          discount, so 0.9 PRUs were billed at $0.04 each — a gross PRU cost of <strong>$0.036</strong>. The user's
          1,000 PRU/month entitlement covers this in full, so the net PRU charge is <strong>$0.00</strong>. Under
          AI Credit based billing, the same request would cost approximately <strong>$0.031</strong> (≈ 3.1 AICs at $0.01
          each).
        </p>

        <AnnotatedRow header={HEADER} values={SAMPLE_ROW_1} annotations={SAMPLE_ROW_1_ANNOTATIONS} />
      </div>

      <div className="report-guide__example">
        <h3 className="report-guide__example-title">Example: Base Model request (0× PRU Multiplier)</h3>
        <p className="report-guide__example-summary">
          On <strong>11 March 2026</strong>, user <strong>mona</strong> made <strong>≈ 25 requests</strong> to{' '}
          <strong>GPT-4.1</strong>, a Base Model. Because Base Models carry a <strong>0× PRU Multiplier</strong>, the
          gross PRU cost is <strong>$0.00</strong> and this usage would not have appeared in the billing report under
          the old model. Under AI Credit based billing, however, the same usage consumed <strong>≈ 24.9 AICs</strong> at
          $0.01 each, producing a token-based cost of approximately <strong>$0.249</strong>.
        </p>

        <AnnotatedRow header={HEADER} values={SAMPLE_ROW_2} annotations={SAMPLE_ROW_2_ANNOTATIONS} />
      </div>
    </section>
  )
}
