# Customer Portfolio Index

Use the customer portfolio index when managing multiple customer deliveries.

It scans a customer project folder for:

- `*-PROJECT-DOSSIER.json`
- `*-manifest.json` release manifests that do not yet have a dossier

Then it creates one portfolio JSON and Markdown report with:

- customer status
- product version
- release slug
- website and GEOFlow URLs
- GEOFlow backend delivery score and status, when attached
- risk counts
- missing project dossier records
- management next actions
- security boundary

## Generate The Portfolio

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerPortfolio `
  -ScanRoot 'D:\Deliveries' `
  -OutputPath 'D:\Deliveries\tongzhuo-customer-portfolio-index.json'
```

You can also call the lower-level script directly:

```powershell
.\scripts\New-CustomerPortfolioIndex.ps1 `
  -ScanRoot 'D:\Deliveries' `
  -OutputPath 'D:\Deliveries\tongzhuo-customer-portfolio-index.json'
```

## How To Use

Review the portfolio before weekly operations or customer success meetings:

- Create `CustomerDossier` for every release-manifest-only customer.
- Attach GEOFlow backend dossier exports for customer records that do not show a backend delivery score.
- Review every customer with `needs_attention` or `risk_count` greater than zero.
- Confirm LaunchPad, AcceptanceReport, OperationsEvidencePack, and SupportBundle are archived beside each project dossier.
- Use `Compare-CustomerDeliveryRelease.ps1` before upgrades.

## Security Boundary

- Portfolio artifacts do not include platform credentials.
- Portfolio artifacts do not include API Tokens.
- Portfolio artifacts do not include cookies, captcha state, or browser profiles.
- Public website content does not include service prices.
