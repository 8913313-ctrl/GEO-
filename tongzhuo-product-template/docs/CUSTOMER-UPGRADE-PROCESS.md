# Customer Upgrade Process

Use this process when an existing customer instance needs to upgrade to a newer Tongzhuo GEO Growth Suite delivery.

## Generate An Upgrade Plan

From the extracted new customer delivery package, run:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action UpgradePlan `
  -CurrentVersion '1.6.1'
```

The command creates two files under `upgrade-plans/`:

- `upgrade-plan-YYYYMMDD-HHMMSS.json`
- `upgrade-plan-YYYYMMDD-HHMMSS.md`

Use `-UpgradeOutputPath` when implementation needs a fixed path:

```powershell
.\Start-CustomerDelivery.ps1 `
  -Action UpgradePlan `
  -CurrentVersion '1.6.1' `
  -UpgradeOutputPath 'D:\Deliveries\customer-a-upgrade-plan.json'
```

## Required Before Upgrade

Before the real install:

1. Record the current customer product version and GEOFlow version.
2. Back up the database.
3. Back up the Laravel project directory.
4. Run `.\Start-CustomerDelivery.ps1 -Action Verify` from the new delivery package.
5. Run the generated server dry-run command on the Linux server.
6. Confirm the desktop publisher agent `.data` directory will be preserved.
7. Prepare a rollback window and operator contact.

## Compare Old And New Delivery Releases

When both the old and new formal customer delivery release artifacts are available, compare them before implementation:

```powershell
.\scripts\Compare-CustomerDeliveryRelease.ps1 `
  -OldReleaseManifestPath 'D:\Deliveries\old\customer-a-tongzhuo-geo-delivery-v1.6.1-manifest.json' `
  -NewReleaseManifestPath 'D:\Deliveries\new\customer-a-tongzhuo-geo-delivery-v1.6.2-manifest.json' `
  -OutputPath 'D:\Deliveries\customer-a-upgrade-comparison.json'
```

The command creates JSON and Markdown comparison reports. It checks:

- customer slug
- website URL
- GEOFlow URL
- product version
- final delivery package hash and size
- GEOFlow server component hash and size
- desktop publisher agent component hash and size
- AI-readable website component hash and size

If the customer slug, website URL, or GEOFlow URL does not match, the comparison status is `blocked`.

## What The Plan Contains

The generated plan includes:

- current version and target version
- customer website and GEOFlow URLs
- package filenames
- server dry-run and install commands
- desktop preflight command
- acceptance report command
- rollback guide command
- upgrade checklist
- rollback notes

## After Upgrade

After the server and desktop agent are upgraded:

1. Open `/geo_admin/publisher-assistant`.
2. Open `/geo_admin/publisher-devices`.
3. Open `/geo_admin/distribution`.
4. Open `/llms.txt`, `/sitemap.xml`, and `/feed.xml`.
5. Publish one test article to the website.
6. Send one desktop publisher queue task.
7. Generate `.\Start-CustomerDelivery.ps1 -Action AcceptanceReport`.

## Security Boundary

The upgrade plan does not include API tokens, platform passwords, cookies, browser profiles, or verification data. Platform login remains on the local operator computer.
