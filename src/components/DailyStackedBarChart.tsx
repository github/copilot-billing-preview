import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export interface DailyData {
  date: string
  primaryValue: number
  secondaryValue: number
}

export interface StackedBarChartProps {
  /** Title displayed above the chart */
  title: string
  /** Array of daily data points */
  data: DailyData[]
  /** Label for the primary (bottom) series */
  primaryLabel: string
  /** Label for the secondary (top) series */
  secondaryLabel: string
  /** Color for the primary series */
  primaryColor?: string
  /** Color for the secondary series */
  secondaryColor?: string
  /** Height of the chart in pixels */
  height?: number
}

export function DailyStackedBarChart({
  title,
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#6366f1',
  secondaryColor = '#22c55e',
  height = 300,
}: StackedBarChartProps) {
  const labels = data.map((d) => d.date)

  const chartData = {
    labels,
    datasets: [
      {
        label: primaryLabel,
        data: data.map((d) => d.primaryValue),
        backgroundColor: primaryColor,
        borderRadius: 2,
      },
      {
        label: secondaryLabel,
        data: data.map((d) => d.secondaryValue),
        backgroundColor: secondaryColor,
        borderRadius: 2,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 14,
          weight: 600,
        },
        padding: {
          bottom: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? 0
            return `${context.dataset.label}: ${value.toLocaleString()}`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: '#e2e8f0',
        },
        ticks: {
          font: {
            size: 11,
          },
          callback: (value) => {
            if (typeof value === 'number') {
              if (value >= 1_000_000) {
                return `${(value / 1_000_000).toFixed(1)}M`
              }
              if (value >= 1_000) {
                return `${(value / 1_000).toFixed(0)}K`
              }
              return value.toString()
            }
            return value
          },
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
      <Bar data={chartData} options={options} />
    </div>
  )
}
