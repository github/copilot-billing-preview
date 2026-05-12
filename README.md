# GitHub Copilot Billing Preview

A web application for previewing and comparing your future GitHub Copilot bills as you transition to the new usage-based billing model. Upload your CSV billing reports to explore requests, costs, AI Credits, and trends across users, organizations, models, and cost centers.

Production instance: <https://copilot-billing-preview.github.com/>

This project is in active development. It is intended to help GitHub Copilot customers understand usage-based billing preview data during the transition period.

## Features

- Parse GitHub Copilot usage billing CSV reports in the browser
- Compare request-based and usage-based billing signals
- Explore usage and cost trends by user, organization, model, product, and cost center
- Review AI Credit usage, included credits, and cost management views

## Scope and limitations

- This app is a preview and planning tool, not a source of record for billing.
- CSV files are processed locally in your browser; do not upload real billing reports to public issues, pull requests, or discussions.
- The app expects GitHub Copilot billing report CSVs that match the current format documented in [docs/report-format.md](docs/report-format.md).
- Billing calculations may change as GitHub Copilot usage-based billing evolves.

## Background

GitHub Copilot Billing Preview helps customers inspect usage-based billing CSV exports before relying on them for planning or budget conversations. For detailed CSV format expectations, see [docs/report-format.md](docs/report-format.md).

Contributions are welcome. Before opening an issue or pull request, avoid sharing real customer data, billing reports, screenshots with sensitive information, or any other private information. For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

### Prerequisites

- Node.js 20.19.0+
- npm

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

### Lint

```bash
npm run lint
```

### Hosting your own copy

You can deploy a private instance of this app to GitHub Pages:

1. **Fork the repository** - click **Fork** on the GitHub repository page to create a copy under your account or organization.

2. **Enable GitHub Pages** - in your fork, go to **Settings > Pages**, set the source to **GitHub Actions**, and save.

3. **Deploy** - the [`.github/workflows/pages.yml`](.github/workflows/pages.yml) workflow runs automatically on every push to `main`. It lints, tests, builds the app, and deploys it to your Pages URL (`https://<your-username>.github.io/<repo-name>/`). You can also trigger it manually from the **Actions** tab using the **Run workflow** button.

## License

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) file for the full terms.

## Maintainers

Maintainers are listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Support

Use GitHub issues to report bugs and request improvements once this repository is public. Do not attach billing CSV files or screenshots that contain sensitive billing information.

Support expectations are documented in [SUPPORT.md](SUPPORT.md).
