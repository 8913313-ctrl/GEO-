import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  desktopDir,
  gitSnapshot,
  sha256File,
  validateBuildManifest,
} from './generate-build-manifest.mjs';
import {
  expectedReleaseArtifacts,
  releaseManifestFilename,
} from './finalize-release-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ensureRelativePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('../') || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe release artifact path: ${relativePath}`);
  }
  return normalized;
}

function withinReleaseDirectory(releaseDir, relativePath) {
  const base = path.resolve(releaseDir);
  const absolutePath = path.resolve(base, ensureRelativePath(relativePath));
  if (!absolutePath.startsWith(`${base}${path.sep}`)) throw new Error(`Release artifact escapes output directory: ${relativePath}`);
  return absolutePath;
}

function parseArguments(args, version) {
  const releaseDir = path.join(desktopDir, 'release');
  const options = {
    releaseDir,
    manifest: path.join(releaseDir, releaseManifestFilename(version)),
    requireCurrentCommit: false,
  };
  let manifestExplicit = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--release-dir') options.releaseDir = path.resolve(args[++index] || '');
    else if (value === '--manifest') {
      options.manifest = path.resolve(args[++index] || '');
      manifestExplicit = true;
    } else if (value === '--require-current-commit') options.requireCurrentCommit = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!manifestExplicit) options.manifest = path.join(options.releaseDir, releaseManifestFilename(version));
  return options;
}

function validateReleaseManifest(manifest, version) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('manifest must be an object');
  if (manifest?.schema_version !== 1) errors.push('unsupported schema_version');
  if (manifest?.product?.version !== version) errors.push('product version does not match package.json');
  if (!String(manifest?.source?.commit || '').trim()) errors.push('source.commit is missing');
  if (!/^[a-f0-9]{64}$/i.test(String(manifest?.source?.build_manifest_sha256 || ''))) errors.push('source build-manifest hash is invalid');
  if (!Array.isArray(manifest?.artifacts) || !manifest.artifacts.length) errors.push('artifacts is empty');
  if (Number.isNaN(new Date(String(manifest?.generated_at || '')).getTime())) errors.push('generated_at is invalid');

  const roles = new Set();
  const paths = new Set();
  for (const artifact of manifest?.artifacts || []) {
    const role = String(artifact?.role || '');
    const relativePath = String(artifact?.path || '');
    try {
      ensureRelativePath(relativePath);
    } catch (error) {
      errors.push(error.message);
    }
    if (!role) errors.push(`artifact role is missing: ${relativePath}`);
    if (roles.has(role)) errors.push(`duplicate artifact role: ${role}`);
    if (paths.has(relativePath)) errors.push(`duplicate artifact path: ${relativePath}`);
    roles.add(role);
    paths.add(relativePath);
    if (!Number.isSafeInteger(artifact?.size) || artifact.size < 0) errors.push(`invalid artifact size: ${relativePath}`);
    if (!/^[a-f0-9]{64}$/i.test(String(artifact?.sha256 || ''))) errors.push(`invalid artifact SHA-256: ${relativePath}`);
  }

  for (const expected of expectedReleaseArtifacts(version)) {
    const found = (manifest?.artifacts || []).find((artifact) => artifact.role === expected.role);
    if (!found) errors.push(`missing artifact role: ${expected.role}`);
    else if (found.path !== expected.path) errors.push(`unexpected path for ${expected.role}: ${found.path}`);
  }
  if (errors.length) throw new Error(`Invalid release manifest: ${errors.join('; ')}`);
  return manifest;
}

function verifyArtifactHashes(releaseDir, manifest) {
  const verified = new Map();
  for (const artifact of manifest.artifacts) {
    const absolutePath = withinReleaseDirectory(releaseDir, artifact.path);
    if (!fs.existsSync(absolutePath)) throw new Error(`Release artifact is missing: ${artifact.path}`);
    const info = fs.statSync(absolutePath);
    if (!info.isFile()) throw new Error(`Release artifact is not a file: ${artifact.path}`);
    if (info.size !== artifact.size) throw new Error(`Release artifact size mismatch: ${artifact.path}`);
    const digest = sha256File(absolutePath);
    if (digest !== artifact.sha256) throw new Error(`Release artifact hash mismatch: ${artifact.path}`);
    verified.set(artifact.role, { ...artifact, absolutePath });
  }
  return verified;
}

function verifyAsar(asarPath, buildManifest) {
  const entries = new Set(asar.listPackage(asarPath).map((entry) => String(entry).replace(/\\/g, '/').replace(/^\/+/, '')));
  const packedFiles = buildManifest.files.filter((file) => file.packed);
  if (!packedFiles.length) throw new Error('Build manifest has no ASAR inputs');

  for (const file of packedFiles) {
    if (!entries.has(file.path)) throw new Error(`ASAR is missing manifest input: ${file.path}`);
    const archivePath = file.path.split('/').join(path.sep);
    const bytes = asar.extractFile(asarPath, archivePath);
    if (bytes.length !== file.size) throw new Error(`ASAR input size mismatch: ${file.path}`);
    if (sha256Buffer(bytes) !== file.sha256) throw new Error(`ASAR input hash mismatch: ${file.path}`);
  }

  const packageJson = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  if (packageJson.version !== buildManifest.product.version) throw new Error('ASAR package version does not match build manifest');
  if (packageJson.main !== 'electron-main.mjs') throw new Error('ASAR package main entry is unexpected');
  return packedFiles.length;
}

function verifyCurrentCommit(buildManifest) {
  const snapshot = gitSnapshot();
  if (!snapshot.available) throw new Error('Cannot confirm the release commit outside a Git checkout');
  if (snapshot.dirty) throw new Error('Cannot confirm release provenance from a dirty Git worktree');
  if (snapshot.commit !== buildManifest.source.commit) {
    throw new Error(`Release commit ${buildManifest.source.commit} does not match current HEAD ${snapshot.commit}`);
  }
}

export function checkReleaseArtifacts(options = {}) {
  const packageJson = readJson(path.join(desktopDir, 'package.json'));
  const releaseDir = path.resolve(options.releaseDir || path.join(desktopDir, 'release'));
  const releaseManifestPath = path.resolve(options.manifest || path.join(releaseDir, releaseManifestFilename(packageJson.version)));
  if (!releaseManifestPath.startsWith(`${releaseDir}${path.sep}`)) throw new Error('Release manifest must be under the release directory');
  if (!fs.existsSync(releaseManifestPath)) throw new Error(`Release manifest is missing: ${releaseManifestPath}`);

  const releaseManifest = validateReleaseManifest(readJson(releaseManifestPath), packageJson.version);
  const artifacts = verifyArtifactHashes(releaseDir, releaseManifest);
  const embedded = artifacts.get('embedded_build_manifest');
  const asarArtifact = artifacts.get('app_asar');
  const buildManifest = validateBuildManifest(readJson(embedded.absolutePath));

  if (embedded.sha256 !== releaseManifest.source.build_manifest_sha256) throw new Error('Embedded build manifest hash does not match release metadata');
  if (buildManifest.product.version !== releaseManifest.product.version) throw new Error('Embedded build manifest version does not match release metadata');
  if (buildManifest.source.commit !== releaseManifest.source.commit) throw new Error('Embedded build manifest commit does not match release metadata');
  if (buildManifest.source.dirty !== false || releaseManifest.source.dirty !== false) throw new Error('Release metadata indicates a dirty source tree');

  const verifiedAsarInputs = verifyAsar(asarArtifact.absolutePath, buildManifest);
  if (options.requireCurrentCommit) verifyCurrentCommit(buildManifest);
  return {
    releaseManifestPath,
    version: packageJson.version,
    artifactCount: artifacts.size,
    verifiedAsarInputs,
    commit: buildManifest.source.commit,
  };
}

function main() {
  const packageJson = readJson(path.join(desktopDir, 'package.json'));
  const result = checkReleaseArtifacts(parseArguments(process.argv.slice(2), packageJson.version));
  console.log(`Release verification passed: ${result.releaseManifestPath}`);
  console.log(`Artifacts: ${result.artifactCount}; ASAR inputs: ${result.verifiedAsarInputs}; commit: ${result.commit}`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
