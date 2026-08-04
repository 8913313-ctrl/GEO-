# Customer Delivery Release Process

Use this process when a customer-specific Tongzhuo GEO Growth Suite delivery must be archived, handed to implementation, or accepted by a customer.

## When To Use

Use `scripts/New-CustomerDeliveryRelease.ps1` for formal customer handoff. It wraps the normal customer delivery package with release evidence:

- customer delivery zip
- validation JSON report
- SHA256 checksum file
- customer delivery release manifest
- customer config review in Markdown and JSON
- customer delivery release summary
- customer delivery release notes in Markdown and JSON
- customer handoff checklist in Markdown and JSON
- customer project archive index in Markdown and JSON

Do not hand off an ad hoc zip when the customer delivery needs to be archived or compared during future upgrades.

## Command

Create and validate the customer config first:

```powershell
.\scripts\New-CustomerConfig.ps1 `
  -CustomerSlug 'customer-a' `
  -CompanyName 'Customer A Network Technology Co Ltd' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://flow.customer-a.com' `
  -OutputPath 'D:\Deliveries\configs\customer-a.json'
```

Then create the formal customer delivery release:

```powershell
.\scripts\New-CustomerDeliveryRelease.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputRoot 'D:\Deliveries\releases' `
  -ReleaseSlug 'customer-a-tongzhuo-geo-delivery-v1.6.2'
```

If the target artifacts already exist, the command stops instead of overwriting them. Use `-Force` only when intentionally regenerating the same release slug.

## Optional Customer Instance Retention

By default, the generated customer instance is temporary and is removed after the archive is created. Keep it only when implementation needs to inspect or customize the generated files:

```powershell
.\scripts\New-CustomerDeliveryRelease.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputRoot 'D:\Deliveries\releases' `
  -ReleaseSlug 'customer-a-tongzhuo-geo-delivery-v1.6.2' `
  -KeepCustomerRoot `
  -CustomerOutputRoot 'D:\Deliveries\customer-a-instance'
```

## Validation Gates

The release command runs these gates:

1. Customer config validation.
2. Customer instance and delivery package generation.
3. Full customer delivery package validation.
4. SHA256 generation for the final customer delivery zip.
5. JSON and Markdown release evidence generation.
6. Customer handoff checklist generation for sign-off.
7. Customer delivery release notes generation for implementation and archive handoff.
8. Full customer delivery release artifact validation.

The final customer delivery zip also includes its own `delivery-manifest.json`, component package hashes, and `Start-CustomerDelivery.ps1 -Action Verify` entrypoint.

## Revalidate After Copying

After copying the release files to another disk, implementation folder, or archive storage, revalidate the artifact group:

```powershell
.\scripts\Test-CustomerDeliveryRelease.ps1 `
  -ReleaseManifestPath 'D:\Deliveries\releases\customer-a-tongzhuo-geo-delivery-v1.6.2-manifest.json' `
  -ExpectedVersion '1.6.2'
```

The validator checks the release manifest, validation report, summary, customer delivery release notes, customer handoff checklist, archive index, SHA256 file, delivery zip hash, delivery zip byte size, and the full internal customer delivery package.

## Handoff Notes

Each formal release includes `*-DELIVERY-RELEASE-NOTES.md`, `*-DELIVERY-RELEASE-NOTES.json`, `*-HANDOFF-CHECKLIST.md`, and `*-HANDOFF-CHECKLIST.json`. These files are for implementation, support, customer acceptance, and future upgrade planning. They include:

- customer website, GEOFlow, publisher assistant, contact lead, and AI crawler endpoints
- customer config review, including endpoint, port, contact completeness, warning, and security-boundary checks
- release artifact hashes and component package integrity
- validation checks that passed before handoff
- required files, pre-handoff checks, post-install checks, and signoff owners
- acceptance commands for local verification, server dry-run, server verification, acceptance report, support bundle generation, and upgrade planning
- preflight report command for checking the delivery package before touching the customer server
- onboarding kit command for aligning kickoff roles, training agenda, first-week cadence, and acceptance targets
- operating plan command for generating the first 30-day GEO optimization, short video operations, enterprise AI landing, distribution, lead review, and AI crawler evidence calendar
- sales kit command for generating customer-facing positioning, demo flow, discovery questions, objection handling, proof points, and next steps without public prices
- success review command for generating first-month evidence, metrics, service-line review, risk response, next-month plan, and renewal discussion materials
- deployment phases and support boundaries

Archive the release notes and handoff checklist together with the manifest, checksum, validation report, archive index, and customer acceptance report.

## Security Boundary

The release must not include:

- customer API tokens
- third-party platform passwords
- cookies or browser profiles
- verification data
- `node_modules`
- runtime logs
- temporary files

Platform login remains on the local operator computer through the Windows desktop publisher agent.
## Customer Service Scope

Before the customer release is signed off, extract the delivery package and run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

Store the generated JSON and Markdown with the release manifest, archive index, delivery release notes, and handoff checklist. This document is the customer-facing boundary for included services, out-of-scope work, responsibilities, acceptance criteria, and change-control items. It must not include public service prices, API Tokens, platform credentials, cookies, browser profiles, or server passwords.

## Customer Product Manual

Before customer kickoff or operator training, extract the delivery package and run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

Store the generated JSON and Markdown with the release manifest, service scope, archive index, delivery release notes, and handoff checklist. This document explains the delivered product modules, service lines, article-to-distribution workflow, operator roles, endpoints, first steps, success metrics, and security boundaries.

## Publishing Loop Acceptance

Before production acceptance, extract the delivery package and run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

Store the generated JSON and Markdown with the release manifest, product manual, service scope, archive index, delivery release notes, and handoff checklist. This document is the acceptance evidence for article publishing, official website AI exposure, distribution tasks, desktop publisher health, result writeback, and local platform-login boundaries.

## Publishing Loop Dry Run

Before connecting real platform accounts, extract the delivery package and run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

Store the generated JSON and Markdown with implementation evidence when the project needs protocol-level proof. This dry run simulates the article payload, website exposure, desktop publisher task, device heartbeat, job claim, result API payload, per-platform result states, and final GEOFlow writeback without storing platform credentials or browser state.
