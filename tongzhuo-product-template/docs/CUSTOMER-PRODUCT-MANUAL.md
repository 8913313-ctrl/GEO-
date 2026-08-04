# Customer Product Manual

Use this process when a customer, operator, implementation engineer, or sales team needs a readable explanation of what the delivered Tongzhuo GEO Growth Suite instance contains and how it should be operated.

## Generate The Product Manual

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

The command creates two files under `product-manuals/`:

- `product-manual-YYYYMMDD-HHMMSS.json`
- `product-manual-YYYYMMDD-HHMMSS.md`

Use `-ProductManualOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action ProductManual `
  -ProductManualOutputPath 'D:\Deliveries\customer-a-product-manual.json'
```

The Markdown file is generated beside the JSON file.

## What The Manual Covers

The product manual includes:

- product positioning
- GEOFlow cloud workbench, AI-readable website, desktop publisher agent, lead workflow, and evidence-kit modules
- three service lines: GEO optimization, short video operations, and enterprise AI landing
- core workflow from article creation to website publishing, distribution task creation, desktop publishing, and result review
- operator roles and responsibilities
- customer first steps after receiving the delivery package
- customer success metrics for first-month operation and renewal evidence
- public website, GEOFlow admin, publisher, lead, crawler-file, and desktop health endpoints
- common delivery commands
- operations evidence pack for article, AI exposure, distribution, publisher device, platform result, and support-boundary proof
- security boundary for prices, API Tokens, platform passwords, cookies, and browser profiles

## Recommended Use

1. Generate `ProductManual` before customer kickoff.
2. Share the Markdown with sales, implementation, customer success, and the customer operator.
3. Use the first-step checklist during the first implementation meeting.
4. Use the success metrics during the first-month review.
5. Archive the JSON/Markdown manual with the release manifest, service scope, and handoff checklist.
6. Generate `OperationsEvidencePack` after the first stable publishing loop so the team can reuse one proof set for support and delivery conversations.

## Security Boundary

The product manual must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, server passwords, or private screenshots. Platform login remains on the Windows operator computer.
