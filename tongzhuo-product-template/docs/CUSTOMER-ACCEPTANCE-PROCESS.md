# Customer Acceptance Process

Use this process after a customer delivery package has been extracted and before the delivery is marked accepted.

## Generate Acceptance Evidence

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action AcceptanceReport
```

The command creates two files under `acceptance-reports/`:

- `acceptance-report-YYYYMMDD-HHMMSS.json`
- `acceptance-report-YYYYMMDD-HHMMSS.md`

Use `-AcceptanceOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action AcceptanceReport `
  -AcceptanceOutputPath 'D:\Deliveries\customer-a-acceptance.json'
```

The Markdown file is generated beside the JSON file.

## What The Report Checks

The acceptance report checks:

- GEOFlow server package version
- Windows desktop publisher agent package version
- AI-readable website package version
- SHA256 and byte size for all three component packages
- required handoff documents
- local operator environment

The report does not include API tokens, platform passwords, cookies, browser profiles, or verification data.

## Acceptance Boundary

This report proves the delivery package is intact on the implementation computer. Final customer acceptance should also include:

1. GEOFlow server dry-run passed.
2. GEOFlow server override package installed.
3. Website routes and AI-readable files are accessible.
4. Desktop publisher agent installed on the operator computer.
5. GEOFlow API Token configured locally in the desktop agent.
6. One test article published to the website.
7. One desktop publisher queue task completed or returned a clear platform-login/manual-action status.
