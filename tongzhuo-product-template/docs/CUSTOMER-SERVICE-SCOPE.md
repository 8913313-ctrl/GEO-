# Customer Service Scope

Use this process before customer kickoff, handoff, renewal, or scope change discussions. The service scope document keeps Tongzhuo GEO Growth Suite positioned as a clear, repeatable service product instead of an open-ended implementation project.

## Generate The Service Scope

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

The command creates two files under `service-scopes/`:

- `service-scope-YYYYMMDD-HHMMSS.json`
- `service-scope-YYYYMMDD-HHMMSS.md`

Use `-ServiceScopeOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action ServiceScope `
  -ServiceScopeOutputPath 'D:\Deliveries\customer-a-service-scope.json'
```

The Markdown file is generated beside the JSON file.

## What The Scope Covers

The service scope includes:

- service lines for GEO optimization, short video operations, and enterprise AI landing
- product deliverables for the website, GEOFlow workbench, content center, customer leads, desktop publisher agent, and acceptance evidence
- included implementation responsibilities
- out-of-scope items that require separate agreement
- customer responsibilities for accounts, approvals, content facts, and operator availability
- acceptance criteria for public website, AI crawler files, GEOFlow integration, article workflow, publisher boundary, and delivery evidence
- change-control rules for domains, extra platforms, custom development, data migration, or new service lines

## Recommended Use

1. Generate `ServiceScope` before the kickoff meeting.
2. Confirm which of the three service lines starts first.
3. Mark any extra platforms, custom templates, or third-party API requirements as change-control items.
4. Archive the JSON/Markdown scope with the release manifest and handoff checklist.
5. Re-run `ServiceScope` when renewal, expansion, or major implementation changes are discussed.

## Security Boundary

The service scope must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, server passwords, or private screenshots. Platform login remains on the Windows operator computer. The server manages content, tasks, devices, leads, and result records.
