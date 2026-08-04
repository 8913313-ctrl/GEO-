# Customer Publishing Loop Acceptance

Use this process to verify the operational loop from GEOFlow article publishing to the official website, distribution task creation, Windows desktop publisher execution, and result writeback.

## Generate The Publishing Loop Acceptance

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

The command creates two files under `publishing-loop-acceptance/`:

- `publishing-loop-acceptance-YYYYMMDD-HHMMSS.json`
- `publishing-loop-acceptance-YYYYMMDD-HHMMSS.md`

Use `-PublishingLoopOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action PublishingLoopAcceptance `
  -PublishingLoopOutputPath 'D:\Deliveries\customer-a-publishing-loop.json'
```

The Markdown file is generated beside the JSON file.

## Generate The Publishing Loop Dry Run

Before connecting real third-party platform accounts, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

The command creates two files under `publishing-loop-dry-runs/`:

- `publishing-loop-dry-run-YYYYMMDD-HHMMSS.json`
- `publishing-loop-dry-run-YYYYMMDD-HHMMSS.md`

Use `-PublishingLoopDryRunOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action PublishingLoopDryRun `
  -PublishingLoopDryRunOutputPath 'D:\Deliveries\customer-a-publishing-loop-dry-run.json'
```

The dry run simulates a GEO article, website exposure, desktop publisher task, device heartbeat, job claim, result API payload, per-platform result states, and final GEOFlow writeback record. It does not log in to real platforms and must not contain API Tokens, platform passwords, cookies, captcha state, or browser profiles.

## Generate The Operations Evidence Pack

After a first successful publishing loop, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack
```

The command creates two files under `operations-evidence-packs/`:

- `operations-evidence-pack-YYYYMMDD-HHMMSS.json`
- `operations-evidence-pack-YYYYMMDD-HHMMSS.md`

Use `-OperationsEvidenceOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action OperationsEvidencePack `
  -OperationsEvidenceOutputPath 'D:\Deliveries\customer-a-operations-evidence.json'
```

The evidence pack is the reusable customer proof set for article publishing, AI crawler exposure, distribution tasks, publisher-device health, per-platform result states, operator closeout, and support boundary review.

## What The Acceptance Covers

The acceptance document confirms:

- official website AI crawler endpoints are declared: page, sitemap, RSS, llms.txt, and llms-full.txt
- GEOFlow backend endpoints are declared: distribution, publisher assistant, publisher devices, and contact leads
- Windows desktop publisher agent health endpoint is declared
- server, desktop, and website packages exist and have matching versions
- publisher device protocol documents jobs, claim, result, and `desktop_publisher`
- deployment commands include publishing-loop acceptance, desktop preparation, acceptance report, and support bundle
- platform credentials stay local and public website prices remain excluded

## What The Dry Run Covers

The dry-run document confirms:

- article payload contains category, service line, canonical URL, keywords, and AI crawler signals
- distribution task uses `desktop_publisher`
- simulated desktop device can claim the job with a worker ID
- result payload uses a server-supported state such as `draft_saved`
- `platform_results` contains per-platform result records
- final GEOFlow distribution record contains assistant result writeback
- fixture output excludes platform credentials, cookies, captcha state, browser profiles, and API Tokens

## Operations Cockpit Review

After the desktop agent writes results back to GEOFlow, review the task in **Distribution Management**:

- assistant state shows whether the task is processing, waiting for confirmation, saved as draft, published, failed, or cancelled
- next operator action shows whether the operator should confirm publishing, log in or pass platform verification, inspect failed platforms, or do nothing
- platform results show each platform state, attempt count, failure category, export path, and remote URL when available
- state summary shows how many platforms reached each state
- retry requeues the task, clears the active assistant state, and preserves the previous assistant result for support evidence
- after manual platform confirmation, operators can record published URLs and notes from Distribution Management
- if manual publishing fails, operators can record the failure reason so the task becomes support-visible instead of remaining ambiguous
- the operations evidence pack can be generated once the loop is stable so implementation, support, and customer success have a reusable proof bundle

## Manual Evidence To Collect

After deployment, collect:

- published official website article URL
- sitemap/RSS/llms.txt entry for the article
- GEOFlow distribution job ID and channel type
- publisher device ID, heartbeat time, and status
- desktop agent run result with `platform_results`
- GEOFlow result record showing state, message, remote URL, or failure reason

## Security Boundary

This acceptance document must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, server passwords, or private screenshots. Platform login remains on the Windows operator computer.
