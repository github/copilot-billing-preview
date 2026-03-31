# Copilot Usage Billing CSV Format

Source examples: files in `examples/`. Some existing sample exports still use the older token-oriented schema.

## Required columns used by the app

| Column | Type | Description |
| --- | --- | --- |
| `date` | ISO date (YYYY-MM-DD) | Day of the usage. |
| `username` | string | GitHub username that generated the request. |
| `product` | string | Product name such as `copilot` or `spark`. |
| `sku` | string | SKU identifier for the billed action, such as `copilot_premium_request`, `coding_agent_premium_request`, `copilot_ai_unit`, `coding_agent_ai_unit`, or `spark_ai_unit`. |
| `model` | string | Model name (for example `Claude Sonnet 4.5`, `Claude Opus 4.6`, `GPT-5.2`). |
| `quantity` | number | Number of billable units for the row. |
| `unit_type` | string | Unit basis for billing. Current reports use values such as `requests` and `ai-units`. The app interprets those row types differently during aggregation. |
| `applied_cost_per_quantity` | number | Unit price applied for each quantity. |
| `gross_amount` | number | Gross charge before discounts. |
| `discount_amount` | number | Discounts applied to the row. |
| `net_amount` | number | Charge after discounts (`gross_amount - discount_amount`). |
| `exceeds_quota` | boolean | Whether the usage exceeded quota (`True` / `False`). |
| `total_monthly_quota` | number | Monthly quota for the user or plan applicable to the row. |
| `organization` | string | Organization slug associated with the usage. |
| `cost_center_name` | string | Optional cost center or tagging field. |
## Optional AI Credit columns

| Column | Status | Notes |
| --- | --- | --- |
| `aic_quantity` | Present in newer previews | Same usage converted to AI Credits. |
| `aic_gross_amount` | Present in newer previews | Used for AI Credit gross cost when present. |
| `total_input_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_output_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_cache_creation_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_cache_read_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |

## Notes
- Header row is single-lined; subsequent rows are usage records. Values are comma-separated, double-quoted where needed.
- Monetary fields are decimals. `aic_quantity` may also be fractional.
- The app streams the file, treats the first row as the header, and counts subsequent data rows without loading the entire file into memory.
- Current calculations support both row types: on `requests` rows, `quantity` and `applied_cost_per_quantity` describe PRU usage while `aic_quantity` and `aic_gross_amount` remain reference/comparison values and stay `0` when those AI Credit fields are absent; on `ai-units` rows, Premium Requests and generic PRU gross/discount/net totals are counted as `0`, while AI Credits and AI Credit gross cost are taken from the AI-specific fields (`aic_quantity` / `aic_gross_amount`, with fallback to `quantity` / `gross_amount` only when those AI-specific fields are absent).
- Reports without `aic_quantity` still load, but AI Credit summaries will display `0`.
