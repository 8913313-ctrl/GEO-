import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSourceFiles,
  createBuildManifest,
  defaultManifestPath,
  desktopDir,
  gitSnapshot,
  readBuildManifest,
  validateBuildManifest,
} from './generate-build-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function parseArguments(args) {
  const options = { source: false, manifest: defaultManifestPath };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--source') options.source = true;
    else if (value === '--manifest') options.manifest = path.resolve(args[++index] || '');
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function sourceInventoryMatches(manifest) {
  const expected = collectSourceFiles();
  const actual = new Map((manifest.files || []).map((file) => [file.path, file]));
  const errors = [];
  if (actual.size !== expected.length) errors.push(`expected ${expected.length} manifest files, found ${actual.size}`);
  for (const file of expected) {
    const found = actual.get(file.path);
    if (!found) {
      errors.push(`missing input: ${file.path}`);
      continue;
    }
    if (found.sha256 !== file.sha256) errors.push(`hash mismatch: ${file.path}`);
    if (found.size !== file.size) errors.push(`size mismatch: ${file.path}`);
    if (found.packed !== file.packed) errors.push(`packed flag mismatch: ${file.path}`);
  }
  for (const filePath of actual.keys()) {
    if (!expected.some((file) => file.path === filePath)) errors.push(`unexpected input: ${filePath}`);
  }
  if (errors.length) throw new Error(`Build manifest does not match source: ${errors.join('; ')}`);
}

function versionMatches(manifest) {
  const packageJson = readJson(path.join(desktopDir, 'package.json'));
  const lockfile = readJson(path.join(desktopDir, 'package-lock.json'));
  if (manifest.product.version !== packageJson.version) throw new Error(`Manifest version ${manifest.product.version} does not match package.json ${packageJson.version}`);
  if (lockfile.version !== packageJson.version || lockfile.packages?.['']?.version !== packageJson.version) {
    throw new Error('package.json and package-lock.json versions do not match');
  }
}

function currentCommitMatches(manifest) {
  const snapshot = gitSnapshot();
  if (snapshot.available && !snapshot.dirty && manifest.source.commit !== snapshot.commit) {
    throw new Error(`Manifest commit ${manifest.source.commit} does not match current HEAD ${snapshot.commit}`);
  }
}

export function checkBuildManifest(options = {}) {
  const manifestPath = path.resolve(options.manifest || defaultManifestPath);
  const exists = fs.existsSync(manifestPath);
  if (!exists && !options.source) throw new Error(`Build manifest is missing: ${manifestPath}`);

  // CI source checks run before a release build.  Validate that the current
  // tree can produce a complete manifest without creating ignored artifacts.
  const manifest = exists ? readBuildManifest(manifestPath) : createBuildManifest();
  validateBuildManifest(manifest);
  versionMatches(manifest);
  sourceInventoryMatches(manifest);
  if (exists) currentCommitMatches(manifest);
  return { manifest, exists, manifestPath };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = checkBuildManifest(options);
  if (result.exists) {
    console.log(`Build manifest verification passed: ${result.manifestPath}`);
  } else {
    console.log(`Build manifest source contract passed: ${result.manifest.files.length} files (no release manifest materialized).`);
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(`Build manifest verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
