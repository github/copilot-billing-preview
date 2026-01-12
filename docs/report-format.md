# Copilot Token Billing CSV Format

Source example: `examples/token-usage.csv` (first line includes a UTF-8 BOM).

| Column | Type | Description |
| --- | --- | --- |
| `date` | ISO date (YYYY-MM-DD) | Day of the usage. |
| `username` | string | GitHub username that generated the request. |
| `product` | string | Product name; sample file uses `copilot`. |
| `sku` | string | SKU identifier; sample uses `copilot_premium_request`. |
| `model` | string | Model name (e.g., `Claude Sonnet 4.5`, `GPT-5.2`, `Gemini 2.5 Pro`). |
| `quantity` | number | Number of billable units for the row (often requests). |
| `unit_type` | string | Unit basis for billing; sample uses `requests`. |
| `applied_cost_per_quantity` | number | Unit price applied for each quantity. |
| `gross_amount` | number | Gross charge before discounts. |
| `discount_amount` | number | Discount applied to the gross amount. |
| `net_amount` | number | Charge after discounts (`gross_amount - discount_amount`). |
| `exceeds_quota` | boolean | Whether the usage exceeded the quota (`True` / `False`). |
| `total_monthly_quota` | number | Monthly quota for the user/org applicable to the SKU. |
| `organization` | string | Organization slug associated with the usage. |
| `cost_center_name` | string | Optional cost center or tagging field. |
| `total_input_tokens` | integer | Token count for inputs in the request window. |
| `total_output_tokens` | integer | Token count for outputs in the request window. |
| `total_cache_creation_tokens` | integer | Tokens used to create caches (if any). |
| `total_cache_read_tokens` | integer | Tokens consumed from cache reads. |

## Notes
- Header row is single-lined; subsequent rows are usage records. Values are comma-separated, double-quoted where needed.  
- Token fields are integers; monetary fields are decimals.  
- The sample file covers dates 2026-01-05 through 2026-01-12 with mixed models and organizations; there are no empty columns, but `cost_center_name` can be blank.  
- The current app streams this file, treats the first row as header, and counts subsequent data rows without loading the entire file into memory.
