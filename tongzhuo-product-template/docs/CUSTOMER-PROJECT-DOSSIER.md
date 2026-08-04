# Customer Project Dossier

Use the customer project dossier after a formal customer delivery release is created.

It aggregates the customer release evidence into one management record:

- customer endpoints
- lifecycle stages
- artifact inventory and hashes
- release validation status
- config review warnings
- launch commands
- risk flags
- management next actions
- security boundary
- GEOFlow backend customer project snapshot, when attached

## Generate The Dossier

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerDossier `
  -ReleaseManifestPath 'D:\Deliveries\customer-a\releases\customer-a-tongzhuo-geo-delivery-v1.7.6-manifest.json' `
  -IntakePath 'D:\Deliveries\customer-a\customer-a-intake-checklist.json' `
  -BackendDossierPath 'D:\Deliveries\customer-a\geoflow-backend-dossier.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-project-dossier.json'
```

The command creates:

- `customer-a-project-dossier.json`
- `customer-a-project-dossier.md`

## When To Archive

Archive the dossier together with:

- intake checklist
- customer config
- release manifest
- delivery package
- checksum
- validation report
- config review
- delivery release notes
- handoff checklist
- archive index
- acceptance report
- operations evidence pack
- support bundle, when generated

## Lifecycle Stages

The dossier tracks these stages:

- intake
- config review
- geoflow backend snapshot
- release validation
- handoff
- launch
- acceptance
- support

## Backend Snapshot

Before a formal review, open the customer project dossier page in GEOFlow and download the backend dossier JSON. Pass that file with `-BackendDossierPath`.

This connects the live server-side customer project state with the offline delivery archive:

- delivery readiness score and status
- remaining delivery tasks
- checklist count
- service line count
- backend export safety boundary
- source file hash in the artifact inventory

## Security Boundary

- Public website content does not include service prices.
- Customer API Tokens are excluded from release artifacts.
- Platform credentials, cookies, captcha state, and browser profiles stay on the Windows operator computer.
- Server-side GEOFlow coordinates tasks, devices, leads, and result records; it does not store third-party platform passwords.
