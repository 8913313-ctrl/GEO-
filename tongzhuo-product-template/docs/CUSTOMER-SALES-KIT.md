# Customer Sales Kit

Use this process when sales, customer success, implementation, or renewal teams need a repeatable customer-facing demo and discovery script for Tongzhuo GEO Growth Suite.

## Generate The Sales Kit

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action SalesKit
```

The command creates two files under `sales-kits/`:

- `sales-kit-YYYYMMDD-HHMMSS.json`
- `sales-kit-YYYYMMDD-HHMMSS.md`

Use `-SalesKitOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action SalesKit `
  -SalesKitOutputPath 'D:\Deliveries\customer-a-sales-kit.json'
```

The Markdown file is generated beside the JSON file.

## What The Kit Covers

The sales kit includes:

- one-sentence positioning for the customer instance
- service-line mapping for GEO optimization, short video operations, and enterprise AI landing
- a demo flow for the website, GEOFlow workbench, desktop publisher boundary, 30-day operating plan, and delivery evidence
- discovery questions for service scope, platform accounts, operators, lead follow-up, and AI workflow readiness
- objection handling for direct publishing, platform changes, public price exposure, and credential safety
- proof points from preflight, onboarding, operating plan, acceptance, support, and release evidence
- next steps for turning the demo into a first-month operating workflow

## Recommended Use

1. Generate `SalesKit` before a customer demo, renewal review, or internal handoff.
2. Use the demo flow to show the AI-readable website first, then GEOFlow, then the desktop publisher boundary.
3. Use the discovery questions to decide the first service line and first-month topic scope.
4. Use the objection-handling section to keep platform login, captcha, and direct-publish expectations clear.
5. Generate `OnboardingKit` and `OperatingPlan` after the customer agrees on owners, accounts, and first-month goals.

## Security Boundary

The sales kit must not include public service prices, customer API Tokens, platform passwords, cookies, browser profiles, verification codes, or private screenshots. It should explain that platform login remains on the Windows operator computer and the server manages content, tasks, devices, leads, and result records.
