import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultManifestPath,
  desktopDir,
  readBuildManifest,
  sha256File,
} from './generate-build-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);

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

function artifactPath(releaseDir, relativePath) {
  const base = path.resolve(releaseDir);
  const absolutePath = path.resolve(base, ensureRelativePath(relativePath));
  if (!absolutePath.startsWith(`${base}${path.sep}`)) throw new Error(`Release artifact escapes output directory: ${relativePath}`);
  return absolutePath;
}

export function releaseManifestFilename(version) {
  return `tongzhuo-geo-publisher-v${version}-release-manifest.json`;
}

export function expectedReleaseArtifacts(version) {
  return [
    { role: 'setup_installer', path: `tongzhuo-geo-publisher-setup-${version}-x64.exe` },
    { role: 'portable_installer', path: `tongzhuo-geo-publisher-portable-${version}-x64.exe` },
    { role: 'app_asar', path: 'win-unpacked/resources/app.asar' },
    { role: 'embedded_build_manifest', path: 'win-unpacked/resources/build-manifest.json' },
  ];
}

function artifactRecord(releaseDir, artifact) {
  const absolutePath = artifactPath(releaseDir, artifact.path);
  if (!fs.existsSync(absolutePath)) throw new Error(`Required release artifact is missing: ${artifact.path}`);
  const info = fs.statSync(absolutePath);
  if (!info.isFile()) throw new Error(`Release artifact is not a file: ${artifact.path}`);
  return {
    role: artifact.role,
    path: artifact.path,
    size: info.size,
    sha256: sha256File(absolutePath),
  };
}

function parseArguments(args) {
  const options = {
    releaseDir: path.join(desktopDir, 'release'),
    buildManifest: defaultManifestPath,
    output: '',
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--release-dir') options.releaseDir = path.resolve(args[++index] || '');
    else if (value === '--build-manifest') options.buildManifest = path.resolve(args[++index] || '');
    else if (value === '--output') options.output = path.resolve(args[++index] || '');
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

export function finalizeReleaseManifest(options = {}) {
  const releaseDir = path.resolve(options.releaseDir || path.join(desktopDir, 'release'));
  const buildManifestPath = path.resolve(options.buildManifest || defaultManifestPath);
  const buildManifest = readBuildManifest(buildManifestPath);
  const packageJson = readJson(path.join(desktopDir, 'package.json'));
  if (buildManifest.product.version !== packageJson.version) {
    throw new Error(`Build manifest version ${buildManifest.product.version} does not match package.json ${packageJson.version}`);
  }

  const records = expectedReleaseArtifacts(packageJson.version)
    .map((artifact) => artifactRecord(releaseDir, artifact));
  const embeddedRecord = records.find((item) => item.role === 'embedded_build_manifest');
  const embeddedPath = artifactPath(releaseDir, embeddedRecord.path);
  const embeddedBytes = fs.readFileSync(embeddedPath);
  const sourceManifestHash = sha256File(buildManifestPath);
  if (sha256Buffer(embeddedBytes) !== sourceManifestHash) {
    throw new Error('The build manifest embedded in win-unpacked does not match the source build manifest');
  }
  const embeddedManifest = readJson(embeddedPath);
  if (embeddedManifest.product?.version !== packageJson.version) {
    throw new Error('Embedded build manifest version does not match package.json');
  }

  const manifest = {
    schema_version: 1,
    product: {
      name: packageJson.name,
      version: packageJson.version,
      app_id: packageJson.build?.appId || '',
    },
    source: {
      commit: buildManifest.source.commit,
      dirty: buildManifest.source.dirty,
      build_manifest_sha256: sourceManifestHash,
      build_manifest_generated_at: buildManifest.build.generated_at,
    },
    generated_at: new Date().toISOString(),
    artifacts: records,
  };
  const outputPath = path.resolve(options.output || path.join(releaseDir, releaseManifestFilename(packageJson.version)));
  if (!outputPath.startsWith(`${releaseDir}${path.sep}`)) throw new Error('Release manifest must be written under the release directory');
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8' });
  return { manifest, outputPath };
}

function main() {
  const result = finalizeReleaseManifest(parseArguments(process.argv.slice(2)));
  console.log(`Release manifest written: ${result.outputPath}`);
  console.log(`Hashed artifacts: ${result.manifest.artifacts.length}`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(`Release manifest finalization failed: ${error.message}`);
    process.exitCode = 1;
  }
}
