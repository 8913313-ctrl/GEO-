# Progress Log

Last updated: 2026-08-18
Branch: `codex/tongzhuo-geo-update-20260809`
Latest code commit: `e97709d`

## Done

1. Cloned and started the project locally.
2. Confirmed the project has a backend CMS and a public frontend.
3. Split the public site into template-specific assets and isolated template styles.
4. Added template support for `03` to `10`.
5. Made template content sources dynamic where possible:
   - services
   - cases
   - articles
   - contact info
   - footer ICP
   - logo
   - default images
6. Fixed the high-frequency flicker issue:
   - throttled shared scroll updates
   - removed redundant reveal scanning
   - narrowed CSS transitions
7. Fixed image overlay issues:
   - `template-02` news image container
   - `template-01` product/news image containers
8. Verified the site checks passed locally.
9. Committed and pushed the current version to GitHub.
10. Deployed the verified code to the Tencent Cloud production server.
11. Created a pre-update production data backup before the container cutover.
12. Verified that the live homepage loads the selected template CSS only.

## Current State

- Local site is running.
- Latest code is already on GitHub.
- Template 01 and 02 media containers are fixed.
- 03-10 templates were checked and do not show the same absolute-position overlay issue.
- Production release: `/opt/tongzhuo-geo/releases/codex-20260818-r1`
- Production compose working directory: `/opt/tongzhuo-geo/releases/codex-20260818-r1/deploy`
- Production code marker: `e97709d`
- Production data backup: `/opt/tongzhuo-geo/backups/pre-update-e97709d-20260818T1945.tgz`
- Live domain checks passed for `tongzhuo.ink` and `admin.tongzhuo.ink`.

## Pending

1. Continue refining template-specific UI behavior if new overlap or flicker appears.
2. Keep syncing future fixes into this log so the work can be traced step by step.
3. Investigate the existing public `/cases/` route returning HTTP 404.
