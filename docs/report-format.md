# Copilot Usage Billing CSV Format

Source examples: files in `examples/`. Some existing sample exports still use the older token-oriented schema.

## Primary columns used by the app

| Column | Type | Description |
| --- | --- | --- |
| `date` | ISO date (YYYY-MM-DD) | Day of the usage. |
| `username` | string | GitHub username that generated the request. |
| `product` | string | Product name such as `copilot` or `spark`. |
| `sku` | string | SKU identifier for the billed action. |
| `model` | string | Model name (for example `Claude Sonnet 4.5`, `Claude Opus 4.6`, `GPT-5.2`). |
| `quantity` | number | Number of billable units for the row. |
| `unit_type` | string | Unit basis for billing. Before cutover this is usually `requests`; after cutover it may be `credits`. |
| `applied_cost_per_quantity` | number | Unit price applied for each quantity. |
| `gross_amount` | number | Gross charge before discounts. |
| `discount_amount` | number | Discounts applied to the row. |
| `net_amount` | number | Charge after discounts (`gross_amount - discount_amount`). |
| `exceeds_quota` | boolean | Whether the usage exceeded quota (`True` / `False`). |
| `total_monthly_quota` | number | Monthly quota for the user or plan applicable to the row. |
| `organization` | string | Organization slug associated with the usage. |
| `cost_center_name` | string | Optional cost center or tagging field. |
| `aiu_quantity` | number | Same usage converted to AI Credits. |

## Additional columns

| Column | Status | Notes |
| --- | --- | --- |
| `aiu_gross_amount` | Present in newer previews | Not currently used by the app. |
| `total_input_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_output_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_cache_creation_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |
| `total_cache_read_tokens` | Legacy / optional | Older token-oriented export field; ignored by the app. |

## Notes
- Header row is single-lined; subsequent rows are usage records. Values are comma-separated, double-quoted where needed.
- Monetary fields are decimals. `aiu_quantity` may also be fractional.
- The app streams the file, treats the first row as the header, and counts subsequent data rows without loading the entire file into memory.
- Reports without `aiu_quantity` still load, but AI Credit summaries will display `0`.
