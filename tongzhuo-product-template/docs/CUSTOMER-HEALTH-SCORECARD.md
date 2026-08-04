# Customer Health Scorecard

The customer health scorecard is a post-launch customer success review artifact for the Tongzhuo GEO Growth Suite.

Use it after go-live, before a monthly review, or before renewal discussion. It turns the customer evidence index and launch readiness scorecard into one account-health view.

## Product Console Usage

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerHealth `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-health-scorecard.json'
```

The command also writes a Markdown version beside the JSON file.

## Direct Script Usage

```powershell
.\scripts\New-CustomerHealthScorecard.ps1 `
  -Root . `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\tongzhuo-customer-health-scorecard.json'
```

If `-EvidenceIndexPath` or `-LaunchReadinessPath` is omitted, the script creates temporary versions by running:

- `New-CustomerEvidenceIndex.ps1`
- `New-CustomerLaunchReadiness.ps1`

## What It Checks

The scorecard reviews:

- Launch readiness status and blocking gates.
- Required delivery evidence completeness.
- Customer acceptance report.
- Operations evidence pack.
- Support bundle.
- GEOFlow backend dossier snapshot freshness and delivery score.
- AI visibility audit availability.
- Credential, API Token, browser profile, and public price boundaries.

## Health Status

- `healthy`: score is at least 90, no blocking gates remain, post-launch evidence is complete, and the backend dossier snapshot is fresh enough to show a usable delivery score.
- `watch`: no blocking gate remains, but launch warnings or non-blocking health gaps should be reviewed.
- `needs_attention`: required launch evidence is usable, but post-launch acceptance, operations, or support evidence is incomplete.
- `blocked`: a required delivery, launch, or security gate is not passed.

## Security Boundary

The scorecard is safe to archive in a customer delivery folder because it does not contain:

- Platform passwords.
- Cookies.
- Captcha state.
- Browser profiles.
- API Tokens.
- Public website service prices.

Store platform login state only in the local desktop publisher agent.
