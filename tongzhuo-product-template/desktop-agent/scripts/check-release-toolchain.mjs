import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { desktopDir, sha256File } from './generate-build-manifest.mjs';
import { finalizeReleaseManifest, releaseManifestFilename } from './finalize-release-manifest.mjs';
import { checkReleaseArtifacts } from './check-release-artifacts.mjs';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const packageJson = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-release-toolchain-'));

try {
  const version = packageJson.version;
  const releaseDir = path.join(temporaryRoot, 'release');
  const sourceAsarDir = path.join(temporaryRoot, 'asar-source');
  const resourcesDir = path.join(releaseDir, 'win-unpacked', 'resources');
  const buildManifestPath = path.join(temporaryRoot, 'build-manifest.json');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const embeddedManifestPath = path.join(resourcesDir, 'build-manifest.json');
  const setupPath = path.join(releaseDir, `tongzhuo-geo-publisher-setup-${version}-x64.exe`);
  const portablePath = path.join(releaseDir, `tongzhuo-geo-publisher-portable-${version}-x64.exe`);
  const mainBytes = Buffer.from('export const releaseFixture = true;\n', 'utf8');

  fs.mkdirSync(sourceAsarDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(path.join(sourceAsarDir, 'electron-main.mjs'), mainBytes);
  fs.writeFileSync(path.join(sourceAsarDir, 'package.json'), JSON.stringify({ version, main: 'electron-main.mjs' }));

  const buildManifest = {
    schema_version: 1,
    product: {
      name: packageJson.name,
      version,
      app_id: packageJson.build?.appId || '',
    },
    source: {
      commit: 'a'.repeat(40),
      git_available: true,
      dirty: false,
      repository_path: '.',
    },
    build: {
      generated_at: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    files: [{
      path: 'electron-main.mjs',
      sha256: sha256(mainBytes),
      size: mainBytes.length,
      packed: true,
    }],
  };

  fs.writeFileSync(buildManifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`, 'utf8');
  fs.copyFileSync(buildManifestPath, embeddedManifestPath);
  await asar.createPackage(sourceAsarDir, asarPath);
  fs.writeFileSync(setupPath, 'fixture setup installer', 'utf8');
  fs.writeFileSync(portablePath, 'fixture portable installer', 'utf8');

  const finalized = finalizeReleaseManifest({ releaseDir, buildManifest: buildManifestPath });
  assert.equal(path.basename(finalized.outputPath), releaseManifestFilename(version));
  const verified = checkReleaseArtifacts({ releaseDir, manifest: finalized.outputPath });
  assert.equal(verified.artifactCount, 4);
  assert.equal(verified.verifiedAsarInputs, 1);
  assert.equal(sha256File(embeddedManifestPath), finalized.manifest.source.build_manifest_sha256);

  fs.appendFileSync(setupPath, 'tampered', 'utf8');
  assert.throws(
    () => checkReleaseArtifacts({ releaseDir, manifest: finalized.outputPath }),
    /artifact (size|hash) mismatch/i,
  );

  console.log('Release toolchain fixture passed.');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
