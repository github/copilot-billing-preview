# GitHub Copilot Usage Billing Report Viewer

A web application for analyzing and visualizing GitHub Copilot usage billing reports. Upload your CSV billing reports and explore requests, costs, AI Credits, and trends across users, organizations, models, and cost centers.

## Features

### Overview Dashboard
- **Quick Statistics**: Total rows, users, organizations, and cost centers at a glance
- **Daily Usage Charts**: Visualize daily requests, AI Credits, and gross-cost breakdowns
- **Per-Model Breakdown**: Analyze requests, costs, and AI Credits by AI model
- **Cost Summary**: Review gross cost, discounts, and net cost for the full report

### Detailed Views
- **Users View**: Breakdown of usage by individual GitHub users
- **Organizations View**: Aggregate usage across your organizations
- **Cost Centers View**: Track usage by cost center for internal billing/allocation

### Performance
- **Streaming CSV Parser**: Efficiently processes large reports without loading entire files into memory
- **Real-time Aggregation**: Multiple aggregators run in parallel during file processing

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to the URL shown (typically `http://localhost:5173`)

### Build

```bash
npm run build
```

The production build will be created in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. Launch the application
2. Upload a GitHub Copilot usage billing CSV report (drag-and-drop or click to browse)
3. The app will parse and analyze the report
4. Explore the visualizations and data views

Sample reports are available in the `examples/` directory. Older examples without `aiu_quantity` still load, but AI Credits will remain `0` for those rows.

## CSV Report Format

The application expects CSV files with the following primary columns:

- `date` - ISO date (YYYY-MM-DD)
- `username` - GitHub username
- `product` - Product name (for example `copilot` or `spark`)
- `sku` - SKU identifier
- `model` - AI model name (for example `Claude Sonnet 4.5`, `GPT-5.2`)
- `quantity` - Number of billable units for the row
- `unit_type` - Unit basis for billing (`requests` today, later `credits` after cutover)
- `applied_cost_per_quantity` - Unit price applied to the row
- `gross_amount` - Gross charge before discounts
- `discount_amount` - Discount applied to the row
- `net_amount` - Net charge after discounts
- `exceeds_quota` - Whether usage exceeded quota
- `total_monthly_quota` - Monthly quota amount
- `organization` - Organization slug
- `cost_center_name` - Optional cost center identifier
- `aiu_quantity` - AI Credits for the same usage row

The viewer currently ignores `aiu_gross_amount`. Legacy token columns may still appear in older exports, but they are no longer used by the app.

See [docs/report-format.md](docs/report-format.md) for detailed format specifications.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Chart.js** + **react-chartjs-2** - Data visualization
- **Streaming CSV Parser** - Memory-efficient data processing

## Project Structure

```text
src/
├── components/          # Reusable UI components
├── pipeline/           # Data processing pipeline
│   ├── aggregators/    # Data aggregation strategies
│   ├── parser.ts       # CSV parser
│   ├── streamer.ts     # File streaming
│   └── runPipeline.ts  # Pipeline orchestration
├── views/              # Main application views
├── utils/              # Utility functions
└── App.tsx             # Main application component
```

## License

MIT
