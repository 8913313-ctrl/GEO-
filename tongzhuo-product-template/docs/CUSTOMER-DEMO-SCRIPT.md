# Customer Demo Script

The customer demo script gives sales, implementation, and customer-success teams one repeatable 45-minute presentation flow.

It demonstrates the full Tongzhuo GEO Growth Suite loop:

- AI-readable public website
- GEOFlow content workbench
- industry insight publishing
- distribution tasks
- Windows desktop publisher boundary
- lead capture
- acceptance evidence
- next-step delivery commands

## Product Console

Generate a demo script from a customer config:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerDemo `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-demo-script.json'
```

Generate one directly before the customer config exists:

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

## Direct Script

```powershell
.\scripts\New-CustomerDemoScript.ps1 `
  -Root . `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-demo-script.json'
```

The command creates both JSON and Markdown files.

## What It Covers

- Preparation checklist
- 45-minute timed demo flow
- Website and AI-readable entrypoints
- GEOFlow article and insight workflow
- Distribution task and desktop publisher boundary
- Lead capture and evidence archive
- Objection handling
- Closeout questions
- Next delivery commands
- Security boundary

## Security Boundary

The demo script does not contain GEOFlow API Tokens, third-party platform passwords, cookies, captcha state, browser profiles, or service prices.
