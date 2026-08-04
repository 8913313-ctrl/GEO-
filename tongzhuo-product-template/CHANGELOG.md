# Changelog

## [1.8.10] - 2026-07-24

- Synchronize each platform's backend login label from the local desktop browser session, including automatic detection after login and periodic rechecks for expiry, verification, or risk controls.
- Keep device connectivity separate from account authentication: a connected device is “在线”; only a verified platform session is “已登录”.

## [1.8.9] - 2026-07-17

- Bundle AI-readable website assets into the GEOFlow server override package and verify them after installation.

## [1.8.8] - 2026-07-17

- Fix website asset delivery paths and add a no-JavaScript visible-content fallback for the AI-readable company website.

## [1.8.7] - 2026-07-17

- Expose first two stages pilot checklist artifacts in the customer delivery wizard and customer release artifact catalog.

## [1.8.6] - 2026-07-17

- Automatically include first two stages pilot checklist artifacts in customer delivery releases, release manifests, and archive indexes.

## [1.8.5] - 2026-07-17

- Add first two stages pilot checklist for customer or internal acceptance of website, AI entrypoints, leads, GEOFlow distribution, desktop publisher binding, platform login boundary, and result writeback.

## [1.8.4] - 2026-07-17

- Add first two stages product preview for cloud GEO workbench, AI-friendly website, distribution management, and Windows desktop publisher agent readiness.

## [1.8.3] - 2026-07-17

- Add customer health scorecard for post-launch customer success, renewal risk, evidence completeness, and next-month action tracking.

## [1.8.2] - 2026-07-17

- Add customer launch readiness scorecard with weighted gates, blocking and warning states, go-live score, and post-launch evidence tracking.

## [1.8.1] - 2026-07-17

- Add single-customer evidence index for sales handoff, AI readiness, release, launch, acceptance, and support artifact completeness.

## [1.8.0] - 2026-07-17

- Add customer proposal brief generator for non-price sales handoff with business goals, service solution, delivery scope, acceptance evidence, customer responsibilities, risks, and security boundaries.

## [1.7.9] - 2026-07-17

- Add customer demo script generator for repeatable sales and implementation demos across website, GEOFlow, desktop publisher, distribution, leads, evidence, and security boundaries.

## [1.7.8] - 2026-07-17

- Add AI visibility audit for website GEO entrypoints, page signals, structured data, article evidence, and public price exclusion.

## [1.7.7] - 2026-07-17

- Add customer portfolio index for multi-customer status, risk, version, and dossier gap management.

## [1.7.6] - 2026-07-17

- Add customer project dossier for lifecycle status, evidence inventory, launch commands, risk flags, and management archive handoff.

## [1.7.5] - 2026-07-17

- Add customer intake checklist for sales-to-implementation handoff, kickoff gates, risk flags, and credential safety boundaries.

## [1.7.4] - 2026-07-17

- Add customer delivery LaunchPad as the root startup page, generated handoff record, and package validation gate.

## [1.7.3] - 2026-07-17

- Enhance customer delivery wizard with productized artifact catalog, launch commands, handoff notes, and optional full-run validation.

## [1.7.2] - 2026-07-17

- Added Quick and Full product readiness modes so day-to-day product releases complete quickly while full customer delivery smoke packaging remains available for major commercial release audits.

## [1.7.1] - 2026-07-17

- Added customer delivery wizard for implementation teams to plan or run new customer delivery workspaces with customer config, formal release package, handoff checklist, archive index, and launch next actions.

## [1.7.0] - 2026-07-17

- Added product delivery console entrypoint for repeatable customer config creation, formal customer releases, product readiness checks, product release packaging, go-live handoff, and support evidence workflows.

## [1.6.9] - 2026-07-17

- Added GoLiveChecklist delivery action for launch-day backup, deployment, website AI verification, desktop publisher setup, publishing loop, lead capture, rollback, and customer signoff readiness.

## [1.6.8] - 2026-07-17

- Added OperatorQuickstart delivery action for customer operators, generating daily workflow, troubleshooting, endpoint, command, and evidence checklist records.

## [1.6.7] - 2026-07-17

- Added customer operations evidence packs for article, AI crawler exposure, distribution, desktop publisher, platform result, operator closeout, and support-boundary proof.
- Integrated OperationsEvidencePack into customer delivery packages, deployment profiles, customer release archive indexes, release notes, handoff checklists, and package validation.

## [1.6.6] - 2026-07-17

- Added GEOFlow operator actions for local publisher tasks so operators can confirm manual platform publishing with URLs and notes or record manual publishing failures with reasons.
- Added publisher operator confirmation history to distribution metadata and surfaced the latest manual record in Distribution Management.
- Added routes and validation gates for publisher confirmation/failure actions so the platform publishing loop has a traceable human-confirmation closeout.

## [1.6.5] - 2026-07-17

- Enhanced the GEOFlow distribution operations table to show desktop publisher next actions, state summaries, per-platform attempts, failure categories, and local publisher retry entry points.
- Updated the publisher assistant result API to persist `state_summary` and `next_operator_action` with `platform_results` for clearer operations handoff.
- Hardened local publisher retry behavior by resetting active assistant state while preserving the previous assistant result for support evidence.

## [1.6.4] - 2026-07-17

- Added a desktop publisher job state machine for platform result summarization, operator actions, failure classification, and bounded retry decisions.
- Updated the desktop agent to execute platforms independently, preserve partial platform results, retry transient runtime failures, and write back `state_summary` plus `next_operator_action` to GEOFlow.
- Documented the publisher device execution state machine, result payload shape, retry boundary, and human-confirmation workflow.

## [1.6.3] - 2026-07-17

- Added publishing-loop dry-run reports from extracted delivery packages, producing JSON and Markdown fixtures for article payloads, website exposure, desktop publisher job claims, result API payloads, per-platform states, GEOFlow writeback, and no-credential security boundaries.
- Integrated PublishingLoopDryRun into customer delivery packages, deployment profiles, formal customer release archive indexes, release notes, handoff checklists, delivery validation, and product documentation.

## [1.6.2] - 2026-07-17

- Productized the Tongzhuo GEO Growth Suite as a reusable release template.
- Added the GEOFlow server override package, AI-readable website package, and Windows desktop publisher agent package.
- Added customer instance generation, customer delivery packaging, complete delivery smoke tests, and product release packaging.
- Added a unified customer delivery entrypoint, operations runbook, release process, and config-driven customer delivery workflow.
- Added server deployment dry-run preflight commands for customer handoff and Linux installation verification.
- Added Windows desktop agent preflight checks and PowerShell syntax validation to catch installation failures before customer handoff.
- Added standalone desktop agent package validation and safe empty-config generation for desktop-only upgrades.
- Added standalone GEOFlow server override package validation for server-only upgrades and safer deployment handoff.
- Added standalone AI-readable website packaging and validation for website-only delivery and GEO/AI crawler handoff.
- Added template secret scanning to block high-risk credentials, private keys, runtime directories, and customer config leaks before release.
- Added formal product release archiving with release zip, readiness report, SHA256 file, and release summary.
- Added formal customer delivery release archiving with customer delivery zip, validation report, SHA256 file, release manifest, and handoff summary.
- Added customer delivery release artifact validation to recheck copied customer archives, hashes, manifests, reports, summaries, and package internals.
- Added customer acceptance reports from extracted delivery packages, producing JSON and Markdown evidence for implementation sign-off.
- Added sanitized customer support bundles from extracted delivery packages, producing JSON and Markdown diagnostics for package integrity, required documents, local desktop health, support collection, and secret-free escalation.
- Added customer preflight reports from extracted delivery packages, producing JSON and Markdown checks for URL planning, desktop port planning, deployment profiles, package integrity, required documents, desktop preflight entrypoints, server command readiness, and local desktop health warnings.
- Added customer onboarding kits from extracted delivery packages, producing JSON and Markdown kickoff roles, account readiness inputs, operator training agenda, first-week operating plan, acceptance targets, and security-boundary guidance.
- Added customer 30-day operating plans from extracted delivery packages, producing JSON and Markdown first-month GEO optimization, short video operations, enterprise AI landing, distribution cadence, lead review, and AI crawler evidence calendars.
- Added customer sales kits from extracted delivery packages, producing JSON and Markdown positioning, service-line mapping, demo flows, discovery questions, objection handling, proof points, next steps, and no-price security boundaries.
- Added customer success reviews from extracted delivery packages, producing JSON and Markdown first-month evidence checklists, metric fields, service-line reviews, risk responses, next-month plans, and renewal discussion prompts.
- Added customer service scope statements from extracted delivery packages, producing JSON and Markdown included scope, excluded items, responsibilities, acceptance criteria, change-control rules, and no-price/credential security boundaries.
- Added customer product manuals from extracted delivery packages, producing JSON and Markdown customer-readable modules, workflows, roles, endpoints, first steps, success metrics, and security boundaries.
- Added publishing-loop acceptance reports from extracted delivery packages, producing JSON and Markdown checks for website AI endpoints, GEOFlow distribution endpoints, desktop publisher health, component versions, result writeback, and local-login security boundaries.
- Added customer upgrade plans from extracted delivery packages, producing JSON and Markdown upgrade checklists with backup, dry-run, install, acceptance, and rollback guidance.
- Added customer delivery release comparison reports for upgrade planning, including customer identity, delivery package, and component package hash/size differences.
- Added a customer config draft generator so implementation can create validated customer JSON before building delivery releases.
- Added customer config review reports in JSON and Markdown for endpoint, port, contact completeness, warning, and security-boundary handoff before customer delivery release.
- Added a dedicated template cleanliness gate to block runtime folders, generated reports, release zips, logs, customer manifests, and temporary artifacts from product releases.
- Added a Linux server post-install verification script and delivery command for GEOFlow override file, route, and optional URL checks.
- Added a generated customer implementation plan inside delivery packages, covering verification, dry-run, install, server verification, desktop setup, acceptance, upgrades, rollback, and security rules.
- Added recursive package secret scanning for product releases, customer delivery packages, and component zips to block leaked credentials and high-risk token patterns.
- Added negative package secret scanner validation to prove blocked filenames, private keys, JSON tokens, known server literals, and nested zip secrets are rejected.
- Added generated customer deployment profiles in JSON and Markdown for customer identity, endpoint, package integrity, command, and support-boundary archiving.
- Added generated customer project archive indexes in JSON and Markdown for internal sales, delivery, support, acceptance, and upgrade traceability.
- Added generated customer delivery release notes in JSON and Markdown for endpoint handoff, artifact integrity, acceptance commands, deployment phases, and support-boundary traceability.
- Added generated customer handoff checklists in JSON and Markdown for required files, SHA256 records, pre-handoff checks, post-install checks, signoff owners, and security-boundary traceability.
- Added explicit customer desktop-agent port configuration separate from the legacy publisher-assistant port, with validation, delivery manifest propagation, deployment profile endpoints, support bundle health checks, and smoke-test coverage.
- Hardened customer deployment profile and project archive validation for URL normalization, endpoint accuracy, package integrity, acceptance commands, and support-boundary declarations.
- Added a product version updater with dry-run/apply modes, changelog insertion, desktop agent version synchronization, and fixture-based validation.
- Added formal product release notes in JSON and Markdown, generated from changelog items, readiness evidence, release artifacts, customer delivery smoke releases, and delivery boundaries.
- Added customer handoff documentation, negative customer config validation, and readiness bill-of-materials fingerprints.
- Hardened delivery and release packaging to exclude customer tokens, platform credentials, browser profiles, runtime data, customer configs, `node_modules`, and temporary artifacts.






















