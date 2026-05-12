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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export interface StackedSeries {
  label: string
  data: number[]
  color: string
}

export interface MultiSeriesStackedBarChartProps {
  title: string
  labels: string[]
  series: StackedSeries[]
  height?: number
}

export function MultiSeriesStackedBarChart({
  title,
  labels,
  series,
  height = 320,
}: MultiSeriesStackedBarChartProps) {
  const chartData = {
    labels,
    datasets: series.map((item) => ({
      label: item.label,
      data: item.data,
      backgroundColor: item.color,
      borderRadius: 2,
    })),
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: {
            size: 11,
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
