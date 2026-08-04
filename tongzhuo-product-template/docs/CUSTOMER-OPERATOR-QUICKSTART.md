# Customer Operator Quickstart

Use this process when a customer operator needs a short daily checklist instead of the full product manual.

## Generate The Quickstart

From the extracted customer delivery folder, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart
```

The command creates two files under `operator-quickstarts/`:

- `operator-quickstart-YYYYMMDD-HHMMSS.json`
- `operator-quickstart-YYYYMMDD-HHMMSS.md`

Use `-OperatorQuickstartOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action OperatorQuickstart `
  -OperatorQuickstartOutputPath 'D:\Deliveries\customer-a-operator-quickstart.json'
```

## What The Quickstart Covers

The quickstart covers:

- opening GEOFlow and checking core menus
- checking the Windows desktop publisher agent
- publishing one website article
- confirming sitemap, RSS, llms.txt, and llms-full.txt exposure
- creating a desktop publisher distribution task
- handling platform login, captcha, drafts, and manual confirmation locally
- closing out platform results in Distribution Management
- archiving operations evidence after the loop is stable

## Security Boundary

The quickstart must not include public service prices, customer API Tokens, third-party platform passwords, cookies, browser profiles, verification codes, server passwords, or private screenshots. Platform login remains on the Windows operator computer.
