# GitHub Copilot Token-Based Billing Report Viewer

A web application for analyzing and visualizing GitHub Copilot token-based billing reports. Upload your CSV billing reports and get insights into token usage, costs, and trends across users, organizations, models, and cost centers.

## Features

### Overview Dashboard
- **Quick Statistics**: Total rows, users, organizations, and cost centers at a glance
- **Daily Token Charts**: Visualize input/output tokens and cache usage over time
- **Per-Model Breakdown**: Analyze token usage and costs by AI model (Claude, GPT, Gemini, etc.)
- **Cost Analysis**: View gross costs, included amounts, and net costs per model

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
2. Upload a GitHub Copilot token billing CSV report (drag-and-drop or click to browse)
3. The app will parse and analyze the report
4. Explore the visualizations and data views

Sample reports are available in the `examples/` directory.

## CSV Report Format

The application expects CSV files with the following columns:

- `date` - ISO date (YYYY-MM-DD)
- `username` - GitHub username
- `product` - Product name (e.g., "copilot")
- `sku` - SKU identifier
- `model` - AI model name (e.g., "Claude Sonnet 4.5", "GPT-5.2")
- `quantity` - Number of billable units
- `unit_type` - Unit basis for billing
- `applied_cost_per_quantity` - Unit price
- `gross_amount` - Gross charge before discounts
- `discount_amount` - Discount applied
- `net_amount` - Net charge after discounts
- `exceeds_quota` - Whether usage exceeded quota
- `total_monthly_quota` - Monthly quota amount
- `organization` - Organization slug
- `cost_center_name` - Optional cost center identifier
- `total_input_tokens` - Input token count
- `total_output_tokens` - Output token count
- `total_cache_creation_tokens` - Cache creation token count
- `total_cache_read_tokens` - Cache read token count

See [docs/report-format.md](docs/report-format.md) for detailed format specifications.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Chart.js** + **react-chartjs-2** - Data visualization
- **Streaming CSV Parser** - Memory-efficient data processing

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (cards, etc.)
│   └── ...             # Feature components (charts, upload)
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
