# Customer 30-Day Operating Plan

Use this process after customer onboarding and before the first month of daily GEO operations begins. The operating plan turns the delivery package into an executable content, distribution, lead, and AI workflow calendar.

## Generate The Operating Plan

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
```

The command creates two files under `operating-plans/`:

- `30-day-operating-plan-YYYYMMDD-HHMMSS.json`
- `30-day-operating-plan-YYYYMMDD-HHMMSS.md`

Use `-OperatingPlanOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action OperatingPlan `
  -OperatingPlanOutputPath 'D:\Deliveries\customer-a-30-day-operating-plan.json'
```

The Markdown file is generated beside the JSON file.

## What The Plan Covers

The operating plan includes:

- first-month objectives for AI-readable company content, service content, distribution, lead evidence, and enterprise AI workflow discovery
- four weekly plans across GEO optimization, short video operations, lead follow-up, and enterprise AI landing
- a starter article topic backlog for GEO optimization, short video operations, and enterprise AI landing
- weekly cadence targets for website articles, short-video scripts, desktop publisher tasks, lead review, and AI crawler file checks
- operating metrics for article URLs, sitemap/RSS/llms.txt evidence, distribution status, publisher device heartbeat, leads, short-video drafts, and AI workflow readiness
- security boundary for API Tokens, platform passwords, cookies, captcha state, browser profiles, and public website price exclusion

## Recommended Use

1. Generate `OnboardingKit` first and confirm owners, accounts, platform login responsibilities, and acceptance targets.
2. Generate `OperatingPlan` and attach the Markdown file to the customer project record.
3. Use Week 1 to publish one foundation article and confirm `sitemap.xml`, `feed.xml`, `llms.txt`, and `llms-full.txt`.
4. Use Week 2 to publish answer-style industry insights and create one distribution task.
5. Use Week 3 to turn customer questions into short-video scripts and desktop publishing tasks.
6. Use Week 4 to choose one low-risk enterprise AI landing scenario and generate acceptance/support evidence.
7. At month end, archive the JSON/Markdown plan with article URLs, distribution results, lead notes, and next-month topics.

## Security Boundary

The operating plan must not contain service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, or screenshots that expose private account data. Platform login remains on the Windows operator computer.
