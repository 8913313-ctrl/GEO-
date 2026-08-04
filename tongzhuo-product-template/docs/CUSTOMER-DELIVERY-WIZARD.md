# Customer Delivery Wizard

`Start-CustomerDeliveryWizard.ps1` is the implementation-facing shortcut for creating a new customer delivery workspace from the reusable product template.

It has two modes:

- `Plan`: creates a JSON and Markdown delivery plan without building packages.
- `Run`: creates the customer config, formal customer release package, checksum, release manifest, handoff checklist, archive index, and wizard summary.

## Plan First

```powershell
.\scripts\Start-CustomerDeliveryWizard.ps1 `
  -Action Plan `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputRoot 'D:\Deliveries\customer-a'
```

## Run Delivery

```powershell
.\scripts\Start-CustomerDeliveryWizard.ps1 `
  -Action Run `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputRoot 'D:\Deliveries\customer-a' `
  -Force
```

The same run can also be started through the product delivery console:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerWizard `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputRoot 'D:\Deliveries\customer-a' `
  -Force
```

## Output Layout

The wizard writes a predictable implementation workspace:

- `configs/<customer>.json`: validated customer config with empty GEOFlow API Token.
- `releases/<release>.zip`: formal customer delivery package.
- `releases/<release>-manifest.json`: release manifest.
- `releases/<release>.sha256`: delivery package checksum.
- `releases/<release>-CONFIG-REVIEW.md`: endpoint, contact, service scope, and warning review.
- `releases/<release>-DELIVERY-RELEASE-SUMMARY.md`: human-readable release summary.
- `releases/<release>-DELIVERY-RELEASE-NOTES.md`: customer-facing release notes and deployment phases.
- `releases/<release>-HANDOFF-CHECKLIST.md`: customer handoff checklist.
- `releases/<release>-archive-index.json` and `releases/<release>-archive-index.md`: long-term delivery archive index.
- `<release>-WIZARD.json` and `<release>-WIZARD.md`: wizard summary and next actions.

The customer delivery zip also includes `LAUNCHPAD.md` at the root. It is the first page for implementation, customer operators, sales, customer success, and support.

The wizard summary is designed to be the first file implementation teams open. It includes:

- Delivery artifact catalog with status, audience, purpose, and file paths.
- Launch commands for verification, preflight, server dry-run, go-live, and desktop agent health.
- Acceptance commands for publishing loop, server verification, dry-run, and signoff.
- Support commands for operations evidence, support bundle, rollback, and upgrade planning.
- Operator handoff notes for implementation, customer operator, and customer success roles.
- Sales handoff positioning, proof points, and promises that must not be made.
- Implementation checklist that ties every launch task to an evidence command or artifact.

## After The Zip Is Extracted

Run these commands from the extracted customer delivery package:

```powershell
.\Start-CustomerDelivery.ps1 -Action Verify
.\Start-CustomerDelivery.ps1 -Action LaunchPad
.\Start-CustomerDelivery.ps1 -Action PreflightReport
.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack
.\Start-CustomerDelivery.ps1 -Action AcceptanceReport
.\Start-CustomerDelivery.ps1 -Action OperationsBundle
```

`OperationsBundle` creates one archive set under `operations-bundles/` after the launch, acceptance, operations evidence, support, dossier, readiness, and health artifacts exist. Use it as the standard customer review and renewal handoff file.

## Validation

Use the lightweight test during routine template checks:

```powershell
.\scripts\Test-CustomerDeliveryWizard.ps1 -Root .
```

Before a formal customer release or product release audit, run the full wizard path:

```powershell
.\scripts\Test-CustomerDeliveryWizard.ps1 -Root . -RunFull
```

`-RunFull` creates a temporary customer config, builds a formal customer release, checks the generated package, and verifies that the wizard summary points to real release notes, config review, archive index, manifest, checksum, and handoff artifacts.

## Security Boundary

- The generated customer config keeps `geoflow.api_token` empty.
- Public website content must not include service prices.
- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the local Windows operator computer.
- Customer release artifacts exclude runtime data and platform login state.
