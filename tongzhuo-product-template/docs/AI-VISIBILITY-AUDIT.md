# AI Visibility Audit

The AI Visibility Audit turns the public website into a measurable GEO asset.

It checks whether the website has the public files, page signals, and content boundaries that search engines and AI answer systems can use safely:

- `robots.txt`
- `sitemap.xml`
- `feed.xml`
- `llms.txt`
- `llms-full.txt`
- page title, description, canonical, robots meta, H1, and JSON-LD
- article author and published-date signals
- public price-text exclusion
- customer placeholders and example domains that must be replaced before launch

## Product Console

Run the audit through the product console:

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action AIVisibility `
  -SiteUrl 'https://www.customer-domain.com' `
  -OutputPath 'D:\Deliveries\customer-a\ai-visibility-audit.json'
```

The command creates a JSON report and a Markdown report next to it.

## Direct Script

```powershell
.\scripts\New-AIVisibilityAudit.ps1 `
  -Root . `
  -SiteUrl 'https://www.customer-domain.com' `
  -OutputPath 'D:\Deliveries\customer-a\ai-visibility-audit.json'
```

For an extracted or customized website folder:

```powershell
.\scripts\New-AIVisibilityAudit.ps1 `
  -Root . `
  -WebsiteRoot 'D:\Deliveries\customer-a\website' `
  -SiteUrl 'https://www.customer-domain.com' `
  -OutputPath 'D:\Deliveries\customer-a\ai-visibility-audit.json'
```

## Report Status

- `ready`: required AI entrypoints exist, no price text is exposed, and recommended page signals are complete.
- `ready_with_warnings`: the website is usable, but placeholders, example domains, or recommended signals need attention before customer launch.
- `failed`: required AI entrypoints are missing or public website files contain blocked price text.

## Delivery Use

Archive the audit with:

- customer project dossier
- go-live evidence
- website deployment evidence
- customer acceptance report

Re-run the audit after changing domains, service pages, sitemap, RSS, `llms.txt`, or article templates.

## Security Boundary

The audit reads only public website files. It does not need GEOFlow API Tokens, third-party platform credentials, browser profiles, cookies, or captcha state.
