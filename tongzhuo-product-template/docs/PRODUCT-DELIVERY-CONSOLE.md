# Product Delivery Console

`Start-ProductDelivery.ps1` is the product-level entrypoint for turning the Tongzhuo GEO Growth Suite template into repeatable customer deliveries and product releases.

Use it when sales, implementation, product, or support teams need one stable command surface instead of memorizing every lower-level script.

Authoritative product blueprint: [`docs/GEO-PRODUCT-BLUEPRINT.md`](./GEO-PRODUCT-BLUEPRINT.md)

## Recommended First Command

```powershell
.\scripts\Start-ProductDelivery.ps1 -Action Plan
```

This creates a JSON and Markdown plan that explains the standard flow:

1. Preview the first two product stages.
2. Generate the product blueprint.
3. Generate the backoffice menu contract.
4. Run the customer delivery wizard.
5. Prepare customer config.
6. Create formal customer release.
7. Run product readiness.
8. Package product release.
9. Run customer go-live checklist.
10. Archive support and operations evidence.

## Common Actions

Generate the first two stages product preview:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action FirstTwoStages `
  -OutputPath 'D:\Deliveries\first-two-stages-preview.json'
```

This creates JSON and Markdown evidence for the cloud GEO workbench, AI-friendly website, distribution management, Windows desktop publisher agent, first ready platform adapters, demo flow, and product boundaries.

Generate the product blueprint:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action ProductBlueprint `
  -OutputPath 'D:\Deliveries\product-blueprint.json'
```

This creates the canonical product definition for the main backend, website CMS, fact base, question map, evidence content, GEO operations, distribution execution, engine layer, and customer delivery bundles.

Generate the backoffice menu contract:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action BackofficeMap `
  -OutputPath 'D:\Deliveries\backoffice-map.json'
```

This creates the stable backend menu contract for overview, website CMS, content growth, GEO operations, distribution execution, customer assets, and system control.

Generate the first two stages pilot checklist from a customer release manifest:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action FirstTwoStagesPilot `
  -ReleaseManifestPath 'D:\Deliveries\customer-a\releases\customer-a-manifest.json' `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\first-two-stages-pilot-checklist.md'
```

This creates a signoff checklist for website pages, AI entrypoints, contact leads, GEOFlow distribution, desktop agent binding, local platform login, task claiming, and result writeback.

Run the AI visibility audit for the public website:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action AIVisibility `
  -SiteUrl 'https://www.customer-a.com' `
  -OutputPath 'D:\Deliveries\customer-a\ai-visibility-audit.json'
```

This creates JSON and Markdown evidence for AI entrypoints, page metadata, structured data, article signals, public price exclusion, placeholder replacement, and launch follow-up actions.

Generate a repeatable customer demo script:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerDemo `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-demo-script.json'
```

This creates a 45-minute sales and implementation demo flow for the AI-readable website, GEOFlow workbench, desktop publisher, distribution loop, lead capture, evidence archive, objection handling, and next commands.

Generate a non-price customer proposal brief:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerProposal `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-proposal-brief.json'
```

This creates JSON and Markdown proposal material for business goals, service lines, delivery scope, timeline, acceptance evidence, customer responsibilities, risks, and security boundaries without exposing prices.

Generate a single-customer evidence index:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerEvidence `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-evidence-index.json'
```

This scans one customer folder and reports whether proposal, demo, intake, AI audit, release manifest, project dossier, acceptance report, operations evidence pack, and support bundle are present.

Generate a go-live readiness scorecard:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerLaunchReadiness `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-launch-readiness.json'
```

This turns the evidence index into a score, blocking gates, warning gates, and a clear launch decision.

Generate the post-launch customer health scorecard:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerHealth `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-health-scorecard.json'
```

This turns launch readiness, delivery evidence, acceptance, operations evidence, support archive, AI visibility, risk flags, and next-month actions into a customer success review view.

Generate the customer operations bundle for archiving or renewal review:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerOpsBundle `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-ops-bundle.json'
```

This creates one archiveable customer operations bundle that ties together the dossier, evidence index, launch readiness, health scorecard, and portfolio index so the product can be handed over, reviewed, and copied with less manual stitching.

Generate the customer intake checklist before delivery packaging:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerIntake `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputRoot 'D:\Deliveries\customer-a'
```

This creates a JSON and Markdown checklist for required customer inputs, kickoff agenda, implementation gates, risk flags, and the boundaries around credentials, captcha, browser profiles, API Tokens, and public prices.

Run the customer delivery wizard:

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

This is the recommended customer delivery entrypoint. A successful wizard run creates the customer config, formal release zip, checksum, manifest, validation report, release notes, config review, handoff checklist, archive index, and a `WIZARD.md` summary for implementation.

Every customer release also contains a root-level `LAUNCHPAD.md`, and the extracted package can generate a timestamped launch record with:

```powershell
.\Start-CustomerDelivery.ps1 -Action LaunchPad
```

The wizard summary groups the delivery into practical handoff sections:

- Delivery artifacts for implementation, customer handoff, and archive storage.
- Launch commands for verification, preflight, server dry-run, go-live, and desktop agent health.
- Acceptance commands for publishing loop validation, server verification, dry-run, and signoff.
- Support commands for operations evidence, support bundle, rollback guide, and upgrade planning.
- Sales and operator handoff notes that explain the cloud workbench plus Windows desktop publisher agent boundary.
- Customer operations bundle notes that package dossier, evidence, launch, health, and portfolio signals into one repeatable archive.

Generate the customer project dossier after the formal release is created:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerDossier `
  -ReleaseManifestPath 'D:\Deliveries\customer-a\releases\customer-a-tongzhuo-geo-delivery-v1.7.6-manifest.json' `
  -IntakePath 'D:\Deliveries\customer-a\customer-a-intake-checklist.json' `
  -BackendDossierPath 'D:\Deliveries\customer-a\geoflow-backend-dossier.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-project-dossier.json'
```

The dossier is the management archive for endpoints, lifecycle status, GEOFlow backend project state, artifact hashes, validation evidence, risk flags, launch commands, and support boundaries.

Generate the customer portfolio index when managing multiple customer projects:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerPortfolio `
  -ScanRoot 'D:\Deliveries' `
  -OutputPath 'D:\Deliveries\tongzhuo-customer-portfolio-index.json'
```

The portfolio index scans project dossiers and release manifests, then summarizes customer status, versions, risks, missing dossiers, and management next actions.

Create a customer config:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action NewCustomerConfig `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -OutputPath 'D:\Deliveries\customer-a.json'
```

Create a formal customer release:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerRelease `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputRoot 'D:\Deliveries\customer-a-release' `
  -ReleaseSlug customer-a-v1 `
  -Force
```

Run product readiness:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action Readiness `
  -OutputPath 'D:\Deliveries\product-readiness.json'
```

Run full product readiness before major commercial release audits:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action Readiness `
  -FullReadiness `
  -OutputPath 'D:\Deliveries\product-readiness-full.json'
```

Package a reusable product release:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action ProductRelease `
  -OutputPath 'D:\Deliveries\tongzhuo-geo-growth-suite.zip'
```

## Customer Package Follow-up

After a customer release zip is extracted, use its `Start-CustomerDelivery.ps1` entrypoint for launch and operations:

```powershell
.\Start-CustomerDelivery.ps1 -Action Verify
.\Start-CustomerDelivery.ps1 -Action PreflightReport
.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack
.\Start-CustomerDelivery.ps1 -Action AcceptanceReport
.\Start-CustomerDelivery.ps1 -Action SupportBundle
.\Start-CustomerDelivery.ps1 -Action OperationsBundle
```

`OperationsBundle` is the archive-level handoff set for customer review, renewal, and support. It bundles the launch pad, acceptance report, operations evidence pack, support bundle, project dossier, launch readiness, and health signals into one repeatable package.

## Security Boundary

- Public website content must not include service prices.
- Product releases must not include customer configs, customer API Tokens, platform passwords, cookies, captcha state, browser profiles, logs, temporary files, `.data`, `node_modules`, or `dist`.
- Third-party platform login remains on the Windows operator computer through the desktop publisher agent.
- The server coordinates content, tasks, devices, leads, and results; it does not store third-party platform passwords.
