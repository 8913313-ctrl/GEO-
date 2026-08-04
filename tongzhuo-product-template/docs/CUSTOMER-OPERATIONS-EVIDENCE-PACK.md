# Customer Operations Evidence Pack

Use this process to collect a reusable proof bundle after the GEOFlow publishing loop is stable.

## Generate The Evidence Pack

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack
```

The command creates two files under `operations-evidence-packs/`:

- `operations-evidence-pack-YYYYMMDD-HHMMSS.json`
- `operations-evidence-pack-YYYYMMDD-HHMMSS.md`

Use `-OperationsEvidenceOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action OperationsEvidencePack `
  -OperationsEvidenceOutputPath 'D:\Deliveries\customer-a-operations-evidence.json'
```

## What The Evidence Pack Covers

The evidence pack captures:

- article publishing evidence
- AI crawler exposure through page, sitemap, RSS, llms.txt, and llms-full.txt
- GEOFlow distribution task state
- publisher-device health and heartbeat
- per-platform result states
- operator confirmation or failure closeout
- support-boundary proof without secrets

## When To Use It

1. After the first successful publishing loop.
2. Before customer success review or support handoff.
3. When implementation needs one stable bundle to show how the product works.

## Security Boundary

The evidence pack must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, server passwords, or private screenshots. Platform login remains on the Windows operator computer.
