import type { ProductUsageResult } from '../pipeline/aggregators/productUsageAggregator'
import { ProductUsageTable } from '../components'
import { InfoTip } from '../components/InfoTip'
import { formatUsd } from '../utils/format'

const PRODUCT_COLORS = ['#2da44e', '#8b5cf6', '#d4a72c', '#54aeff', '#cf222e', '#fd8c73', '#8b949e']

type ProductsViewProps = {
  data: ProductUsageResult
}

export function ProductsView({ data }: ProductsViewProps) {
  const maxCost = data.products.reduce((value, product) => {
    return Math.max(value, product.totals.netAmount, product.totals.aicNetAmount)
  }, 0)

  if (data.products.length === 0) {
    return (
      <section className="flex flex-col gap-5">
        <h2 className="m-0 text-lg text-fg-default">Usage by product</h2>
        <div className="bg-bg-default border border-border-default rounded-md p-4 text-fg-muted">No product usage found in this report.</div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Usage by product">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="m-0 text-lg text-fg-default">Usage by product</h2>
          <span className="text-[13px] text-fg-muted">{data.products.length.toLocaleString()} total</span>
        </div>
        <div className="text-[13px] text-fg-muted">PRU = $0.04/request · AIC = $0.01/unit</div>
      </div>

      <div className="bg-bg-default border border-border-default rounded-md flex flex-col gap-5 p-5">
        <div className="flex flex-wrap gap-3.5 text-[11px] text-fg-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-[5px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-[rgba(207,34,46,0.7)]" />
            PRU net cost
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-fg-accent" />
            AIC net cost
          </span>
        </div>

        <div className="flex flex-col gap-3.5" role="presentation">
          {data.products.map((product, index) => {
            const pruWidth = maxCost > 0 ? (product.totals.netAmount / maxCost) * 100 : 0
            const aicWidth = maxCost > 0 ? (product.totals.aicNetAmount / maxCost) * 100 : 0

            return (
              <div key={product.product} className="grid grid-cols-[minmax(140px,180px)_minmax(0,1fr)] gap-3.5 items-start">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}
                    aria-hidden="true"
                  />
                    <span className="text-[13px] font-semibold text-fg-default">
                      {product.product}
                      {product.product === 'Copilot Cloud Agent' && (
                        <InfoTip
                          text="Formerly known as Copilot Coding Agent"
                          buttonLabel="More info about the Copilot Cloud Agent rename"
                        />
                      )}
                    </span>
                </div>

                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-3.5 rounded-[4px] overflow-hidden bg-bg-muted">
                      <div className="h-full rounded-[4px] min-w-0 bg-[rgba(207,34,46,0.7)]" style={{ width: `${pruWidth}%` }} />
                    </div>
                    <span className="min-w-[72px] text-[10px] font-medium tabular-nums whitespace-nowrap text-fg-danger">{formatUsd(product.totals.netAmount)}</span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-3.5 rounded-[4px] overflow-hidden bg-bg-muted">
                      <div className="h-full rounded-[4px] min-w-0 bg-fg-accent" style={{ width: `${aicWidth}%` }} />
                    </div>
                    <span className="min-w-[72px] text-[10px] font-medium tabular-nums whitespace-nowrap text-fg-accent">{formatUsd(product.totals.aicNetAmount)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ProductUsageTable products={data.products} />
    </section>
  )
}
