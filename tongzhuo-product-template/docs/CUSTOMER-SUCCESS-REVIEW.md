# Customer Success Review

Use this process after the first month of GEO operations. The review turns article, distribution, lead, short-video, and AI workflow evidence into a customer success and renewal handoff document.

## Generate The Success Review

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action SuccessReview
```

The command creates two files under `success-reviews/`:

- `success-review-YYYYMMDD-HHMMSS.json`
- `success-review-YYYYMMDD-HHMMSS.md`

Use `-SuccessReviewOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action SuccessReview `
  -SuccessReviewOutputPath 'D:\Deliveries\customer-a-success-review.json'
```

The Markdown file is generated beside the JSON file.

## What The Review Covers

The success review includes:

- first-month evidence checklist for articles, AI crawler files, distribution tasks, publisher devices, leads, short-video topics, and enterprise AI scenario notes
- metric fields and owners for content, distribution, leads, short-video operations, and AI landing readiness
- service-line review questions for GEO optimization, short video operations, and enterprise AI landing
- risk review and response plan
- next-month operating plan checklist
- renewal or expansion discussion prompts without public pricing
- security boundary for API Tokens, platform credentials, cookies, browser profiles, and public price exclusion

## Recommended Use

1. Generate `OperatingPlan` at the start of the first month.
2. Collect article URLs, crawler-file evidence, distribution task results, lead records, and AI workflow notes during the month.
3. Generate `SuccessReview` at the end of the first month.
4. Fill in metric values and customer-specific evidence.
5. Use the risk review and next-month plan to align renewal, expansion, or implementation priorities.
6. Archive the JSON/Markdown review with the customer project records.

## Security Boundary

The success review must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, or private screenshots. Platform login remains on the Windows operator computer.
