# Copilot Usage Billing CSV Format

The app expects the current usage-based billing preview export schema.

## Required columns used by the app

| Column | Type | Description |
| --- | --- | --- |
| `date` | ISO date (YYYY-MM-DD) | Day of the usage. |
| `username` | string | GitHub username that generated the request. |
| `product` | string | Product name such as `copilot` or `spark`. |
| `sku` | string | SKU identifier for the billed action, such as `copilot_premium_request`, `coding_agent_premium_request`, `copilot_ai_credit`, `coding_agent_ai_credit`, or `spark_ai_credit`. |
| `model` | string | Model name (for example `Claude Sonnet 4.5`, `Claude Opus 4.6`, `GPT-5.2`). |
| `quantity` | number | Number of billable units for the row. |
| `unit_type` | string | Unit basis for billing. `requests` rows are processed as request/PRU usage; any other value is processed as AI Credit usage. |
| `applied_cost_per_quantity` | number | Unit price applied for each quantity. |
| `gross_amount` | number | Gross charge before discounts. |
| `discount_amount` | number | Discounts applied to the row. |
| `net_amount` | number | Charge after discounts (`gross_amount - discount_amount`). |
| `exceeds_quota` | boolean | Whether the usage exceeded quota (`True` / `False`). |
| `total_monthly_quota` | number | Monthly quota for the user or plan applicable to the row. |
| `organization` | string | Organization slug associated with the usage. |
| `cost_center_name` | string | Optional cost center or tagging field. |
| `aic_quantity` | number | Same usage converted to AI Credits. |
| `aic_gross_amount` | number | AI Credit gross cost. |

## Notes
- Header row is single-lined; subsequent rows are usage records. Values are comma-separated, double-quoted where needed.
- Monetary fields are decimals. `aic_quantity` may also be fractional.
- The app streams the file, treats the first row as the header, and counts subsequent data rows without loading the entire file into memory.
- Current calculations split rows by `unit_type`: on `requests` rows, `quantity` and `applied_cost_per_quantity` describe request/PRU usage while `aic_quantity` and `aic_gross_amount` remain reference/comparison values; on any non-`requests` row, request/PRU gross/discount/net totals are counted as `0`, while AI Credits and AI Credit gross cost are taken from the AI-specific fields (`aic_quantity` / `aic_gross_amount`), with fallback to `quantity` / `gross_amount` only when those AI-specific fields are blank.
- The current app expects the current CSV format, including `aic_quantity` and `aic_gross_amount`.
