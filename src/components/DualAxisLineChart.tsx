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
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

export interface LineSeries {
  label: string
  data: number[]
  color: string
  yAxisID: string
}

export interface DualAxisLineChartProps {
  title: string
  labels: string[]
  series: [LineSeries, LineSeries]
  height?: number
  formatYAsCurrency?: boolean
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
}: DualAxisLineChartProps) {
  const tickFormatter = formatYAsCurrency ? formatUsdTick : formatTick
  const usesSecondaryAxis = series.some((dataset) => dataset.yAxisID === 'y1')
  const sharedAxisColor = '#475569'
  const primaryAxisTitle = usesSecondaryAxis ? series[0].label : `${series[0].label} / ${series[1].label}`
  const primaryAxisColor = usesSecondaryAxis ? series[0].color : sharedAxisColor

  const chartData = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.color + '20',
      yAxisID: s.yAxisID,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
      fill: false,
    })),
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
        },
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
