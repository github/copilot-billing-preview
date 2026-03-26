import { useMemo, useState } from 'react'
import type { ProductUsage, ProductUsageResult } from '../pipeline/aggregators/productUsageAggregator'
import { formatAiu, formatUsd } from '../utils/format'

const PRODUCT_COLORS = ['#2da44e', '#8b5cf6', '#d4a72c', '#54aeff', '#cf222e', '#fd8c73', '#8b949e']

type ProductsViewProps = {
  data: ProductUsageResult
}

function formatInt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function ProductsView({ data }: ProductsViewProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    () => new Set(data.products[0] ? [data.products[0].product] : []),
  )

  const maxCost = data.products.reduce((value, product) => {
    return Math.max(value, product.totals.grossAmount, product.totals.aiuGrossAmount)
  }, 0)

  const modelRowsByProduct = useMemo(() => {
    const entries = data.products.map((product) => {
      const modelRows = Object.entries(product.models)
        .map(([model, totals]) => ({ model, totals }))
        .sort((a, b) => b.totals.grossAmount - a.totals.grossAmount)

      return [product.product, modelRows] as const
    })

    return Object.fromEntries(entries)
  }, [data.products])

  const toggleProduct = (product: string) => {
    setExpandedProducts((current) => {
      const next = new Set(current)
      if (next.has(product)) {
        next.delete(product)
      } else {
        next.add(product)
      }
      return next
    })
  }

  if (data.products.length === 0) {
    return (
      <section className="products-view">
        <h2 className="products-view__heading">Usage by product</h2>
        <div className="products-view__empty">No product usage found in this report.</div>
      </section>
    )
  }

  return (
    <section className="products-view" aria-label="Usage by product">
      <div className="products-view__header">
        <div className="products-view__titleGroup">
          <h2 className="products-view__heading">Usage by product</h2>
          <span className="products-view__count">{data.products.length.toLocaleString()} total</span>
        </div>
        <div className="products-view__rateNote">PRU = $0.04/request · AIC = $0.01/unit</div>
      </div>

      <div className="products-view__card card">
        <div className="products-view__legend" aria-hidden="true">
          <span className="products-view__legendItem">
            <span className="products-view__legendSwatch products-view__legendSwatch--pru" />
            PRU cost
          </span>
          <span className="products-view__legendItem">
            <span className="products-view__legendSwatch products-view__legendSwatch--aiu" />
            AIC cost
          </span>
        </div>

        <div className="products-view__bars" role="presentation">
          {data.products.map((product, index) => {
            const pruWidth = maxCost > 0 ? (product.totals.grossAmount / maxCost) * 100 : 0
            const aiuWidth = maxCost > 0 ? (product.totals.aiuGrossAmount / maxCost) * 100 : 0

            return (
              <div key={product.product} className="products-view__barRow">
                <div className="products-view__barLabel">
                  <span
                    className="products-view__barDot"
                    style={{ backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="products-view__barName">{product.product}</span>
                </div>

                <div className="products-view__barStack">
                  <div className="products-view__barValues">
                    <div className="products-view__barTrack products-view__barTrack--pru">
                      <div className="products-view__barFill products-view__barFill--pru" style={{ width: `${pruWidth}%` }} />
                    </div>
                    <span className="products-view__barValue products-view__barValue--pru">{formatUsd(product.totals.grossAmount)}</span>
                  </div>

                  <div className="products-view__barValues">
                    <div className="products-view__barTrack products-view__barTrack--aiu">
                      <div className="products-view__barFill products-view__barFill--aiu" style={{ width: `${aiuWidth}%` }} />
                    </div>
                    <span className="products-view__barValue products-view__barValue--aiu">{formatUsd(product.totals.aiuGrossAmount)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="products-view__card card">
        <div className="products-view__tableWrap data-table-wrap">
          <table className="products-view__table data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="products-view__num">PRUs</th>
                <th className="products-view__num">PRU Cost</th>
                <th className="products-view__num">AICs</th>
                <th className="products-view__num">AIC Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product, index) => {
                const isExpanded = expandedProducts.has(product.product)
                const modelRows = modelRowsByProduct[product.product] ?? []

                return (
                  <ProductRows
                    key={product.product}
                    product={product}
                    productIndex={index}
                    isExpanded={isExpanded}
                    modelRows={modelRows}
                    onToggle={toggleProduct}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

type ProductRowsProps = {
  product: ProductUsage
  productIndex: number
  isExpanded: boolean
  modelRows: Array<{ model: string; totals: ProductUsage['totals'] }>
  onToggle: (product: string) => void
}

function ProductRows({ product, productIndex, isExpanded, modelRows, onToggle }: ProductRowsProps) {
  const color = PRODUCT_COLORS[productIndex % PRODUCT_COLORS.length]

  return (
    <>
      <tr className="products-view__productRow">
        <td>
          <button
            type="button"
            className="products-view__toggle"
            onClick={() => onToggle(product.product)}
            aria-expanded={isExpanded}
          >
            <span className={`products-view__chevron${isExpanded ? ' products-view__chevron--expanded' : ''}`} aria-hidden="true">
              ▶
            </span>
            <span className="products-view__tableDot" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="products-view__name">{product.product}</span>
          </button>
        </td>
        <td className="products-view__num">{formatInt(product.totals.requests)}</td>
        <td className="products-view__num">{formatUsd(product.totals.grossAmount)}</td>
        <td className="products-view__num">{formatAiu(product.totals.aiuQuantity)}</td>
        <td className="products-view__num">{formatUsd(product.totals.aiuGrossAmount)}</td>
      </tr>

      {isExpanded &&
        modelRows.map((row) => (
          <tr key={`${product.product}-${row.model}`} className="products-view__modelRow">
            <td className="products-view__modelCell">{row.model}</td>
            <td className="products-view__num">{formatInt(row.totals.requests)}</td>
            <td className="products-view__num">{formatUsd(row.totals.grossAmount)}</td>
            <td className="products-view__num">{formatAiu(row.totals.aiuQuantity)}</td>
            <td className="products-view__num">{formatUsd(row.totals.aiuGrossAmount)}</td>
          </tr>
        ))}
    </>
  )
}
