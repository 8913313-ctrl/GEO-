# Customer Go-Live Checklist

`GoLiveChecklist` creates the launch-day checklist for a customer delivery. Use it when the delivery package is ready to move from preparation into production deployment and first operational validation.

```powershell
.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist
```

The action writes JSON and Markdown files under `go-live-checklists/` by default.

Use `-GoLiveOutputPath` when implementation needs a fixed archive path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action GoLiveChecklist `
  -GoLiveOutputPath 'D:\Deliveries\customer-a-go-live-checklist.json'
```

## What It Covers

- Pre-go-live package verification, backup confirmation, domain confirmation, and no-price public website boundary.
- Server dry-run, install, verification, and GEOFlow route checks.
- Official website, sitemap, RSS, `llms.txt`, and `llms-full.txt` verification for AI crawler readability.
- Windows desktop publisher agent setup and local platform login boundary.
- Article publishing, distribution task, desktop job claim, result writeback, and operator closeout.
- Website lead form submission and GEOFlow Contact Leads verification.
- Rollback readiness before customer signoff.
- Acceptance report, operations evidence pack, and customer signoff archive.

## Required Evidence

The generated checklist asks the implementation team to collect evidence for each phase:

- `Verify` and `PreflightReport` output.
- Server backup or snapshot ID.
- Server dry-run, install, and verification output.
- Public website URL, sitemap, RSS, `llms.txt`, and `llms-full.txt`.
- Desktop preflight output and local health endpoint.
- Publisher device heartbeat and distribution task result.
- Test article URL, platform results, and operator closeout note.
- Test contact lead ID.
- Rollback guide and previous-version record.
- Acceptance report and operations evidence pack.

## Security Boundary

The go-live checklist is intentionally safe to archive and share with implementation or support teams:

- It does not include service prices for the public website.
- It does not include customer API Tokens.
- It does not include third-party platform passwords.
- It does not include cookies, captcha state, browser profiles, screenshots, or verification codes.
- Third-party platform login remains on the Windows operator computer.
- Support does not bypass third-party platform captcha or platform risk controls.
