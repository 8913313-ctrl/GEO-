# Customer Launch Readiness

The launch readiness scorecard turns a customer evidence folder into a go-live decision.

It reports:

- score out of 100
- passed gates
- blocking gates
- warning gates
- evidence paths
- next actions

## Product Console

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action CustomerLaunchReadiness `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-launch-readiness.json'
```

## Direct Script

```powershell
.\scripts\New-CustomerLaunchReadiness.ps1 `
  -Root . `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\customer-a-launch-readiness.json'
```

The script generates or reads a customer evidence index, then evaluates:

- required-before-launch artifacts
- AI visibility audit
- customer release manifest
- launch-ready project dossier
- GEOFlow backend dossier snapshot, when attached
- configuration review
- evidence security boundary
- post-launch acceptance, operations, and support evidence

## Decision Rules

- `ready`: all gates pass.
- `ready_with_warnings`: no blocking launch gate remains, but post-launch evidence or a non-blocking review remains.
- `blocked`: one or more required launch gates are not passed.

Missing post-launch evidence does not block first launch, but it remains visible until AcceptanceReport, OperationsEvidencePack, and SupportBundle are archived. If the GEOFlow backend snapshot is missing or weak, the launch gate stays blocked until a fresh backend dossier export is attached.

## Security Boundary

The scorecard must not contain platform passwords, cookies, captcha state, browser profiles, customer API Tokens, server passwords, private screenshots, or public website price text.
