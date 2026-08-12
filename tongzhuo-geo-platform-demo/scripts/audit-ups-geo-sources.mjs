import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1] || "");
  index += 1;
}
const sourceRoot = path.resolve(args.get("source") || path.join(projectRoot, "..", "UPS_GEO"));
const outputPath = path.resolve(args.get("output") || path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-SOURCE-MANIFEST-20260811.json"));

async function filesUnder(directory, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const childRelative = path.join(relative, entry.name);
    if ([".git", ".tmp", "projects", "references", "scripts"].includes(entry.name) && !relative) continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(child, childRelative));
    else if (entry.isFile() && /^(?:README\.md|docs[\\/].+\.(?:md|csv)|research[\\/].+\.(?:md|csv))$/i.test(childRelative)) result.push({ absolute: child, relative: childRelative.split(path.sep).join("/") });
  }
  return result;
}

function gitMetadata(relative) {
  try {
    const value = execFileSync("git", ["-C", sourceRoot, "log", "-1", "--format=%H%x09%an%x09%aI%x09%s", "--", relative], { encoding: "utf8" }).trim();
    const [commit = "", author = "", committedAt = "", subject = ""] = value.split("\t");
    return { commit, author, committedAt, subject };
  } catch {
    return { commit: "", author: "", committedAt: "", subject: "uncommitted or git metadata unavailable" };
  }
}

const sourceStat = await stat(sourceRoot);
if (!sourceStat.isDirectory()) throw new Error(`UPS_GEO source directory not found: ${sourceRoot}`);
const sourceFiles = await filesUnder(sourceRoot);
const records = [];
for (const file of sourceFiles) {
  const buffer = await readFile(file.absolute);
  records.push({
    path: file.relative,
    bytes: buffer.byteLength,
    modifiedAt: (await stat(file.absolute)).mtime.toISOString(),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    git: gitMetadata(file.relative),
    classification: file.relative.startsWith("research/") ? "research-note" : file.relative.startsWith("docs/") ? "project-contract" : "project-readme",
    reuseDecision: "candidate-for-review-only"
  });
}

const manifest = {
  manifestVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceRoot,
  sourceRepository: { remote: "https://github.com/lake121380-source/UPS_GEO.git", head: gitMetadata("README.md").commit, license: "No root LICENSE file found; internal working materials, redistribution rights require owner confirmation." },
  exclusions: [
    { path: "projects/", reason: "customer-specific facts and evidence; never import into global geo-core" },
    { path: "references/", reason: "third-party repository snapshots; retain original license and notice files, do not copy prose/data into customer assets without review" },
    { path: "scripts/", reason: "research tooling requires separate security and dependency review" }
  ],
  relatedRepositorySnapshots: [
    { name: "geo-citation-lab", commit: "81ba1566f70f114e9202b798f8d4525a9329ebd3", license: "MIT for software; CC BY 4.0 for original content; third-party terms remain" },
    { name: "GEOFlow", commit: "4786cab802055db3e81aa7ea388b6329ffb01d3f", license: "Apache-2.0" },
    { name: "yao-geo-skills", commit: "201c0c45ccaa2047530b2295679a9aa116f4d3e4", license: "MIT" }
  ],
  files: records,
  nextReview: ["owner/license confirmation", "source-level citation locator", "fact/opinion/evidence classification", "six-theme method extraction"]
};
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ sourceRoot, outputPath, fileCount: records.length, excludedCustomerProjects: true }, null, 2));
