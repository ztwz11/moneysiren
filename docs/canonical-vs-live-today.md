# Canonical Data vs live_today

MoneySiren separates confirmed local history from provisional live refresh data.

## Canonical

Canonical data is the normalized SQLite snapshot history created by CLI sync or scheduled collection. It represents stored history up to the latest confirmed sync window, usually through yesterday.

## live_today

`live_today` is a provisional overlay from a manual or local read-only refresh for the current dashboard date. It is useful for seeing today's usage, but it is not the same as confirmed historical data.

## UI Language

Use clear labels:

- `confirmed through yesterday`
- `today live`
- `provisional`
- `estimated`
- `unknown`

Avoid presenting live values as final invoices or confirmed billing records.

## Example

```text
Confirmed month-to-date: $42.13
Today live estimate: about $3.20
Month-end forecast: $89 - $104
Data confidence: medium
```

## Security

`live_today` responses must be sanitized. They must not include raw provider payloads, provider credentials, account IDs, project IDs, invoice IDs, emails, card data, local prompt text, or raw CLI log lines.
