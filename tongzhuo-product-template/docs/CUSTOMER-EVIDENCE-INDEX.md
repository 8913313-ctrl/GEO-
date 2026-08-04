# Customer Evidence Index

The customer evidence index scans one customer delivery folder and creates a management record of which sales, launch, and acceptance artifacts exist.

Use it when implementation, customer success, or product operations need to answer:

- Do we have the customer proposal brief?
- Do we have the demo script?
- Do we have intake, AI visibility audit, release manifest, and project dossier before launch?
- After launch, did we archive the acceptance report, operations evidence pack, and support bundle?

## Product Console

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerEvidence `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-evidence-index.json'
```

## Direct Script

```powershell
.\scripts\New-CustomerEvidenceIndex.ps1 `
  -Root . `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-evidence-index.json'
```

The command creates JSON and Markdown files.

## Status

- `empty`: no recognized evidence artifacts were found.
- `needs_attention`: required-before-launch artifacts are missing.
- `ready_for_launch_evidence_pending`: launch artifacts are ready, but after-launch evidence is not complete yet.
- `complete`: required-before-launch and recommended-after-launch evidence artifacts are present.

## Required Before Launch

- customer proposal brief
- customer demo script
- customer intake checklist
- AI visibility audit
- customer release manifest
- customer project dossier
- GEOFlow backend dossier snapshot, when attached

## Recommended After Launch

- acceptance report
- operations evidence pack
- support bundle

## Security Boundary

The evidence index records artifact paths, hashes, sizes, stages, status, and backend snapshot signals. It must not contain platform passwords, cookies, captcha state, browser profiles, customer API Tokens, server passwords, private screenshots, or public website price text.
