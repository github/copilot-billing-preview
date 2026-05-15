import { useMemo, useState } from 'react'
import { InfoTip } from './InfoTip'
import { th, thNum, td, tdNum } from './ui/tableStyles'
import { formatAic, formatDifference, formatUsd } from '../utils/format'

export type ProductUsageTableTotals = {
  requests: number
  aicQuantity: number
  netAmount: number
  aicNetAmount: number
}

export type ProductUsageTableProduct = {
  product: string
  totals: ProductUsageTableTotals
  models: Record<string, ProductUsageTableTotals>
}

export type ProductUsageTableProps = {
  products: ProductUsageTableProduct[]
  title?: string
}

const PRODUCT_COLORS = ['#2da44e', '#8b5cf6', '#d4a72c', '#54aeff', '#cf222e', '#fd8c73', '#8b949e']

function formatInt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function ProductUsageTable({ products, title }: ProductUsageTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    () => new Set(),
  )

  const modelRowsByProduct = useMemo(() => {
    const entries = products.map((product) => {
      const modelRows = Object.entries(product.models)
        .map(([model, totals]) => ({ model, totals }))
        .sort((a, b) => {
          const costDiff = b.totals.netAmount - a.totals.netAmount
          return costDiff !== 0 ? costDiff : a.model.localeCompare(b.model)
        })

      return [product.product, modelRows] as const
    })

    return Object.fromEntries(entries)
  }, [products])

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

  return (
    <div className="bg-bg-default border border-border-default rounded-md overflow-auto">
      {title && (
        <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 py-3 border-b border-bg-muted">
          <h3 className="m-0 text-base font-semibold text-fg-default">{title}</h3>
        </div>
      )}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={th}>Product</th>
            <th className={thNum}>PRUs</th>
            <th className={thNum}>PRU net cost</th>
            <th className={thNum}>AICs</th>
            <th className={thNum}>AIC net cost</th>
            <th className={thNum}>Difference</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <ProductRows
              key={product.product}
              product={product}
              productIndex={index}
              isExpanded={expandedProducts.has(product.product)}
              modelRows={modelRowsByProduct[product.product] ?? []}
              onToggle={toggleProduct}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

type ProductRowsProps = {
  product: ProductUsageTableProduct
  productIndex: number
  isExpanded: boolean
  modelRows: Array<{ model: string; totals: ProductUsageTableTotals }>
  onToggle: (product: string) => void
}

function ProductRows({ product, productIndex, isExpanded, modelRows, onToggle }: ProductRowsProps) {
  const color = PRODUCT_COLORS[productIndex % PRODUCT_COLORS.length]
  const productDiff = product.totals.netAmount - product.totals.aicNetAmount

  return (
    <>
      <tr className="hover:[&_td]:bg-bg-default">
        <td className={td}>
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border-none bg-transparent p-0 font-inherit text-inherit cursor-pointer hover:[&_.product-name]:text-fg-accent focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 focus-visible:rounded-[4px]"
              onClick={() => onToggle(product.product)}
              aria-expanded={isExpanded}
            >
              <span className={`w-3 text-fg-muted text-[9px] leading-none transition-transform duration-150 ease-in-out${isExpanded ? ' rotate-90' : ''}`} aria-hidden="true">
                ▶
              </span>
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="product-name text-[13px] font-semibold text-fg-default">{product.product}</span>
            </button>
            {product.product === 'Copilot Cloud Agent' && (
              <InfoTip
                text="Formerly known as Copilot Coding Agent"
                buttonLabel="More info about the Copilot Cloud Agent rename"
              />
            )}
          </span>
        </td>
        <td className={tdNum}>{formatInt(product.totals.requests)}</td>
        <td className={tdNum}>{formatUsd(product.totals.netAmount)}</td>
        <td className={tdNum}>{formatAic(product.totals.aicQuantity)}</td>
        <td className={tdNum}>{formatUsd(product.totals.aicNetAmount)}</td>
        <td
          className={`${tdNum} font-semibold ${productDiff > 0 ? 'text-app-savings-fg' : productDiff < 0 ? 'text-fg-danger' : 'text-fg-muted'}`}
        >
          {formatDifference(productDiff)}
        </td>
      </tr>

      {isExpanded &&
        modelRows.map((row) => {
          const modelDiff = row.totals.netAmount - row.totals.aicNetAmount

          return (
            <tr key={`${product.product}-${row.model}`} className="[&_td]:bg-bg-default">
              <td className="pl-11 pr-4 py-3 border-b border-bg-muted whitespace-nowrap text-xs text-fg-muted">{row.model}</td>
              <td className={`${tdNum} text-fg-muted`}>{formatInt(row.totals.requests)}</td>
              <td className={`${tdNum} text-fg-muted`}>{formatUsd(row.totals.netAmount)}</td>
              <td className={`${tdNum} text-fg-muted`}>{formatAic(row.totals.aicQuantity)}</td>
              <td className={`${tdNum} text-fg-muted`}>{formatUsd(row.totals.aicNetAmount)}</td>
              <td
                className={`${tdNum} font-semibold ${modelDiff > 0 ? 'text-app-savings-fg' : modelDiff < 0 ? 'text-fg-danger' : 'text-fg-muted'}`}
              >
                {formatDifference(modelDiff)}
              </td>
            </tr>
          )
        })}
    </>
  )
}
