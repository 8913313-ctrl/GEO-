import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { appendAuditLog } from "../production-audit.mjs";

const WORKSPACE_ID = "default";
const TARGET_NAVIGATION_IDS = Object.freeze(["nav-team", "nav-honors", "nav-issues", "nav-careers"]);
const apply = process.argv.includes("--apply");
const databaseArgument = process.argv.find((argument) => argument.startsWith("--database="));
const databasePath = path.resolve(databaseArgument?.slice("--database=".length) || process.env.TZ_DATABASE_PATH || "data/tongzhuo-production.sqlite");

function checksum(json) {
  return createHash("sha256").update(json).digest("hex");
}

function cleanNavigation(snapshot, surface) {
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.navItems)) throw new Error(`${surface} snapshot has no navItems array`);
  const copy = structuredClone(snapshot);
  const matches = new Map(TARGET_NAVIGATION_IDS.map((id) => [id, []]));
  copy.navItems.forEach((item, index) => {
    if (matches.has(item?.id)) matches.get(item.id).push(index);
  });
  for (const [id, indexes] of matches) {
    if (indexes.length !== 1) throw new Error(`${surface} snapshot expected exactly one ${id}, received ${indexes.length}`);
  }
  const before = TARGET_NAVIGATION_IDS.map((id) => {
    const item = copy.navItems[matches.get(id)[0]];
    return { id, label: item.label || "", path: item.path || "", visible: item.visible !== false };
  });
  for (const id of TARGET_NAVIGATION_IDS) copy.navItems[matches.get(id)[0]].visible = false;
  const changed = before.filter((item) => item.visible).map((item) => item.id);
  return { snapshot: copy, before, changed };
}

let database;
try {
  database = new ProductionDatabase({ databasePath });
  const draftRow = database.connection.prepare(`
    SELECT workspace_id, revision, snapshot_json, checksum
    FROM site_cms_drafts
    WHERE workspace_id = ?
  `).get(WORKSPACE_ID);
  const publicationRow = database.connection.prepare(`
    SELECT p.workspace_id, p.release_id, p.version_number, r.source_draft_revision,
      r.snapshot_json, r.checksum
    FROM site_cms_publications p
    JOIN site_cms_releases r ON r.id = p.release_id
    WHERE p.workspace_id = ?
  `).get(WORKSPACE_ID);
  if (!draftRow || !publicationRow) throw new Error("site CMS draft or publication is missing");

  const draft = cleanNavigation(JSON.parse(draftRow.snapshot_json), "draft");
  const publication = cleanNavigation(JSON.parse(publicationRow.snapshot_json), "publication");
  const plan = {
    mode: apply ? "apply" : "dry-run",
    databasePath,
    workspaceId: WORKSPACE_ID,
    targets: TARGET_NAVIGATION_IDS,
    draft: { revision: Number(draftRow.revision), changed: draft.changed, before: draft.before },
    publication: { releaseId: publicationRow.release_id, version: Number(publicationRow.version_number), changed: publication.changed, before: publication.before },
    pagesDeleted: 0,
    historicalReleasesMutated: false
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply after creating and validating a production backup.");
    process.exitCode = 2;
  } else if (!draft.changed.length && !publication.changed.length) {
    console.log("Primary navigation is already clean; no database rows changed.");
  } else {
    const now = new Date().toISOString();
    const nextDraftRevision = Number(draftRow.revision) + (draft.changed.length ? 1 : 0);
    const nextVersion = Number(publicationRow.version_number) + (publication.changed.length ? 1 : 0);
    const nextReleaseId = publication.changed.length ? `SITE-REL-${randomUUID()}` : publicationRow.release_id;
    const draftJson = JSON.stringify(draft.snapshot);
    const publicationJson = JSON.stringify(publication.snapshot);
    const draftChecksum = checksum(draftJson);
    const publicationChecksum = checksum(publicationJson);

    database.transaction(() => {
      if (draft.changed.length) {
        const result = database.connection.prepare(`
          UPDATE site_cms_drafts
          SET revision = ?, snapshot_json = ?, checksum = ?, updated_at = ?, updated_by = NULL
          WHERE workspace_id = ? AND revision = ? AND checksum = ?
        `).run(nextDraftRevision, draftJson, draftChecksum, now, WORKSPACE_ID, Number(draftRow.revision), draftRow.checksum);
        if (Number(result.changes) !== 1) throw new Error("site CMS draft changed after the repair plan was created");
      }
      if (publication.changed.length) {
        database.connection.prepare(`
          INSERT INTO site_cms_releases (
            id, workspace_id, version_number, source_draft_revision, source_release_id,
            operation, snapshot_json, checksum, note, created_at, created_by
          ) VALUES (?, ?, ?, ?, ?, 'publish', ?, ?, ?, ?, NULL)
        `).run(
          nextReleaseId,
          WORKSPACE_ID,
          nextVersion,
          Number(publicationRow.source_draft_revision),
          publicationRow.release_id,
          publicationJson,
          publicationChecksum,
          "系统维护：基于当前正式版本隐藏错误扩展页导航，不发布草稿中的其他改动",
          now
        );
        const result = database.connection.prepare(`
          UPDATE site_cms_publications
          SET release_id = ?, version_number = ?, published_at = ?, published_by = NULL
          WHERE workspace_id = ? AND release_id = ? AND version_number = ?
        `).run(nextReleaseId, nextVersion, now, WORKSPACE_ID, publicationRow.release_id, Number(publicationRow.version_number));
        if (Number(result.changes) !== 1) throw new Error("site CMS publication changed after the repair plan was created");
      }
      appendAuditLog(database.connection, {
        action: "site.cms.navigation.repair",
        entityType: "site_cms_publication",
        entityId: nextReleaseId,
        createdAt: now,
        details: {
          operator: "codex-assisted-maintenance",
          authorization: "workspace-owner-approved-ordered-repair",
          command: "scripts/repair-site-primary-navigation.mjs --apply",
          targetNavigationIds: TARGET_NAVIGATION_IDS,
          draftRevisionBefore: Number(draftRow.revision),
          draftRevisionAfter: nextDraftRevision,
          publicationReleaseBefore: publicationRow.release_id,
          publicationReleaseAfter: nextReleaseId,
          publicationVersionBefore: Number(publicationRow.version_number),
          publicationVersionAfter: nextVersion,
          pagesDeleted: 0,
          historicalReleasesMutated: false
        }
      });
    });

    const integrity = database.connection.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrity !== "ok") throw new Error(`database integrity check failed after repair: ${integrity}`);
    console.log(JSON.stringify({
      ok: true,
      draftRevision: nextDraftRevision,
      publicationReleaseId: nextReleaseId,
      publicationVersion: nextVersion,
      hiddenNavigationIds: TARGET_NAVIGATION_IDS,
      pagesDeleted: 0,
      historicalReleasesMutated: false,
      integrity
    }, null, 2));
  }
} finally {
  database?.close();
}
