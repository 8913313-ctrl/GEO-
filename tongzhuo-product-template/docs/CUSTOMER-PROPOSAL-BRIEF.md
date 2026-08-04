# Customer Proposal Brief

The customer proposal brief is a non-price customer-facing document for turning a demo or discovery call into a clear delivery proposal.

It explains:

- customer business goals
- GEO optimization, short-video operations, and enterprise AI implementation service lines
- delivery scope
- delivery timeline
- acceptance evidence
- customer responsibilities
- risks and assumptions
- next commands for implementation
- security and no-price boundaries

## Product Console

Generate from a customer config:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerProposal `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-proposal-brief.json'
```

Generate directly before the customer config exists:

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

## Direct Script

```powershell
.\scripts\New-CustomerProposalBrief.ps1 `
  -Root . `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-proposal-brief.json'
```

The command creates JSON and Markdown files.

## Non-Price Boundary

The proposal brief intentionally does not include service fees, quotes, payment terms, or contract clauses. Keep commercial terms in a separate business document.

## Security Boundary

The brief must not contain GEOFlow API Tokens, third-party platform passwords, cookies, captcha state, browser profiles, server passwords, private screenshots, or public website price text.
