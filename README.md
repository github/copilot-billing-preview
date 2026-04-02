# GitHub Copilot Billing Preview

A web application for previewing and comparing your future GitHub Copilot bills as you transition to the new AI Credits-based billing model. Upload your CSV billing reports to explore requests, costs, AI Credits, and trends across users, organizations, models, and cost centers.


## Getting Started

### Prerequisites
- Node.js 24+
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

### Test

```bash
npm run test
```

## Usage

1. Launch the application
2. Upload a GitHub Copilot usage billing CSV report (drag-and-drop or click to browse)
3. The app will parse the report and compare request-based and AI Credits-based billing signals
4. Explore the visualizations and data views to preview how future bills may look after the AI Credits transition

If you don't have your own data yet, export a GitHub Copilot billing CSV from your organization that matches the current format, including the `aic_quantity` and `aic_gross_amount` columns.

## Hosting Your Own Copy

You can deploy a private instance of this app to GitHub Pages:

1. **Fork the repository** — click **Fork** on the GitHub repository page to create a copy under your account or organization.

2. **Enable GitHub Pages** — in your fork, go to **Settings → Pages**, set the source to **GitHub Actions**, and save.

3. **Deploy** — the [`.github/workflows/pages.yml`](.github/workflows/pages.yml) workflow runs automatically on every push to `main`. It lints, tests, builds the app, and deploys it to your Pages URL (`https://<your-username>.github.io/<repo-name>/`). You can also trigger it manually from the **Actions** tab using the **Run workflow** button.

## CSV Report Format

See [docs/report-format.md](docs/report-format.md) for detailed format specifications.

