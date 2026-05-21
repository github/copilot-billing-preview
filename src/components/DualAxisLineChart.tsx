import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type LegendItem,
  type ScriptableLineSegmentContext,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

export interface LineSeries {
  label: string
  legendLabel?: string
  legendOrder?: number
  data: Array<number | null>
  color: string
  yAxisID: string
  borderDash?: number[]
  order?: number
  pointRadius?: number
  segmentColor?: (startValue: number, endValue: number) => string
}

export interface ExtraLegendItem {
  label: string
  color: string
  legendOrder?: number
}

export interface DualAxisLineChartProps {
  title: string
  labels: string[]
  series: [LineSeries, LineSeries, ...LineSeries[]]
  height?: number
  formatYAsCurrency?: boolean
  extraLegendItems?: ExtraLegendItem[]
}

type OrderedLegendItem = LegendItem & {
  legendOrder?: number
}

function formatTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toString()
}

function formatUsdTick(value: number): string {
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

export function DualAxisLineChart({
  title,
  labels,
  series,
  height = 320,
  formatYAsCurrency = false,
  extraLegendItems = [],
}: DualAxisLineChartProps) {
  const tickFormatter = formatYAsCurrency ? formatUsdTick : formatTick
  const usesSecondaryAxis = series.some((dataset) => dataset.yAxisID === 'y1')
  const [primarySeries, secondarySeries] = series
  const sharedAxisColor = '#475569'
  const primaryAxisTitle = usesSecondaryAxis ? primarySeries.label : `${primarySeries.label} / ${secondarySeries.label}`
  const primaryAxisColor = usesSecondaryAxis ? primarySeries.color : sharedAxisColor

  const chartData = {
    labels,
    datasets: series.map((s) => {
      const segmentColor = s.segmentColor
      const pointRadius = s.pointRadius ?? 2
      const pointColor = segmentColor
        ? s.data.map((value) => (typeof value === 'number' ? segmentColor(value, value) : s.color))
        : s.color

        return {
        label: s.label,
        legendLabel: s.legendLabel,
        legendOrder: s.legendOrder,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color + '20',
        pointBackgroundColor: pointColor,
        pointBorderColor: pointColor,
        yAxisID: s.yAxisID,
        tension: 0.3,
        pointRadius,
        pointHoverRadius: pointRadius === 0 ? 0 : 5,
        borderWidth: 2,
        borderDash: s.borderDash,
        order: s.order,
        segment: segmentColor
          ? {
              borderColor: (context: ScriptableLineSegmentContext) => {
                const startValue = Number(context.p0.parsed.y)
                const endValue = Number(context.p1.parsed.y)
                return segmentColor(startValue, endValue)
              },
            }
          : undefined,
        fill: false,
      }
    }),
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: { size: 11, weight: 500 },
          generateLabels: (chart) => {
            const defaultLabels = ChartJS.defaults.plugins.legend.labels.generateLabels?.(chart) ?? []
            const datasetLabels: OrderedLegendItem[] = defaultLabels.map((item) => {
              const dataset = typeof item.datasetIndex === 'number'
                ? chart.data.datasets[item.datasetIndex] as { legendLabel?: string, legendOrder?: number }
                : undefined

              return {
                ...item,
                text: dataset?.legendLabel ?? item.text,
                legendOrder: dataset?.legendOrder,
              }
            })

            const additionalLabels: OrderedLegendItem[] = extraLegendItems.map((item) => ({
              text: item.label,
              fillStyle: item.color,
              strokeStyle: item.color,
              hidden: false,
              lineWidth: 2,
              legendOrder: item.legendOrder,
            }))

            return [...datasetLabels, ...additionalLabels].sort((a, b) => {
              return (a.legendOrder ?? a.datasetIndex ?? 0) - (b.legendOrder ?? b.datasetIndex ?? 0)
            })
          },
        },
        onClick: () => undefined,
      },
      title: {
        display: true,
        text: title,
        font: { size: 14, weight: 600 },
        padding: { bottom: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? 0
            const formatted = formatYAsCurrency ? formatUsdTick(value) : value.toLocaleString()
            return `${context.dataset.label}: ${formatted}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: primaryAxisTitle,
          font: { size: 11, weight: 500 },
          color: primaryAxisColor,
        },
        grid: { color: '#e2e8f0' },
        ticks: {
          font: { size: 11 },
          color: primaryAxisColor,
          callback: (value) => (typeof value === 'number' ? tickFormatter(value) : value),
        },
      },
      y1: {
        display: usesSecondaryAxis,
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: series[1].label,
          font: { size: 11, weight: 500 },
          color: series[1].color,
        },
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 11 },
          color: series[1].color,
          callback: (value) => (typeof value === 'number' ? tickFormatter(value) : value),
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  }

  return (
    <div className="bg-bg-default border border-border-default rounded-md p-4 w-full [&_canvas]:!w-full" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
