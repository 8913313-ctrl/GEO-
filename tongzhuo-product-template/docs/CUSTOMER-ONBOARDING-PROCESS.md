# Customer Onboarding Process

Use this process after the delivery package is extracted and before the customer operator starts daily GEO operations.

## Generate The Onboarding Kit

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
```

The command creates two files under `onboarding/`:

- `onboarding-kit-YYYYMMDD-HHMMSS.json`
- `onboarding-kit-YYYYMMDD-HHMMSS.md`

Use `-OnboardingOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action OnboardingKit `
  -OnboardingOutputPath 'D:\Deliveries\customer-a-onboarding.json'
```

The Markdown file is generated beside the JSON file.

## What The Kit Covers

The onboarding kit includes:

- customer website, GEOFlow, publisher assistant, publisher device, distribution, contact lead, sitemap, RSS, and llms.txt endpoints
- kickoff roles and owners
- account and access readiness inputs
- customer operator training agenda
- first-week operating plan
- acceptance targets for website publishing, desktop queue, publisher device heartbeat, and lead capture
- security boundary for API Tokens, platform passwords, cookies, captcha state, and browser profiles

## Recommended Kickoff

1. Confirm customer owner, content operator, desktop operator, server engineer, and implementation manager.
2. Confirm domain, GEOFlow admin, Windows operator computer, platform accounts, and first service/category scope.
3. Run `PreflightReport` before touching the customer server.
4. Run `OnboardingKit` and walk through the training agenda with the customer.
5. Publish one article to the website and verify sitemap, RSS, llms.txt, and llms-full.txt.
6. Create one desktop publisher task and confirm device heartbeat plus task result.
7. Generate `OperatingPlan` after owners and accounts are confirmed, then use it as the first-month GEO operations calendar.
8. Generate `AcceptanceReport` after the first successful content loop.

## Security Boundary

Do not ask the customer to send platform passwords, cookies, browser profiles, API Tokens, verification codes, or screenshots that expose private platform account data. Platform login remains on the Windows operator computer.
