# Customer Intake Checklist

Use the customer intake checklist before creating a formal customer delivery package.

It turns sales and implementation inputs into one JSON and Markdown handoff record:

- required customer information
- kickoff agenda
- implementation gates
- risk flags
- do-not-collect boundaries
- do-not-promise boundaries
- next commands for config, wizard, LaunchPad, and preflight

## Generate From Sales Inputs

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerIntake `
  -CustomerSlug customer-a `
  -CompanyName 'Customer A Network Technology Co., Ltd.' `
  -ShortName 'Customer A' `
  -SiteUrl 'https://www.customer-a.com' `
  -GeoFlowBaseUrl 'https://work.customer-a.com' `
  -Telephone '400-000-0000' `
  -Email 'ops@customer-a.com' `
  -Address 'Zibo, Shandong' `
  -OutputRoot 'D:\Deliveries\customer-a'
```

## Generate From Existing Config

```powershell
.\scripts\New-CustomerIntakeChecklist.ps1 `
  -ConfigPath 'D:\Deliveries\customer-a.json' `
  -OutputPath 'D:\Deliveries\customer-a-intake-checklist.json'
```

## What Must Be Confirmed

- Company legal name, brand name, services, and public organization description.
- Website domain, sitemap, feed, `llms.txt`, and `llms-full.txt` exposure plan.
- Public telephone, email, address, or service region for conversion and structured data.
- GEOFlow base URL, admin path, server access window, backup owner, and rollback owner.
- Windows operator computer, desktop publisher agent port, browser channel, and startup policy.
- Third-party platform account owners without collecting passwords, cookies, browser profiles, captcha state, or verification codes.
- First content topics, brand facts, case material, service scope, and forbidden claims.
- Acceptance test: one website article, one distribution task, one desktop result writeback, one lead submission, and one evidence archive.

## Security Boundary

- Public website content does not include service prices.
- Customer API Token stays empty before packaging.
- Platform credentials, cookies, captcha state, browser profiles, and verification codes stay on the Windows operator computer.
- Server-side GEOFlow coordinates content, tasks, devices, leads, and result records; it does not store third-party platform passwords.
- Do not promise pure server-side login, captcha bypass, or guaranteed direct publish when a platform blocks automation.
