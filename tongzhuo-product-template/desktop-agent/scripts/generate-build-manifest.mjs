import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const desktopDir = path.resolve(__dirname, '..');
export const metadataDir = path.join(desktopDir, '.release-metadata');
export const defaultManifestPath = path.join(metadataDir, 'build-manifest.json');

const fixedSourceFiles = Object.freeze([
  'electron-main.mjs',
  'package-lock.json',
  'package.json',
  'preload.cjs',
]);
const packedFixedFiles = new Set(['electron-main.mjs', 'preload.cjs']);
const sourceDirectories = Object.freeze(['public', 'src']);

function toPortablePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function filesUnder(root, relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) throw new Error(`Required source directory is missing: ${relativeDirectory}`);
  const files = [];
  const visit = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in release inputs: ${toPortablePath(path.relative(root, absolutePath))}`);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(toPortablePath(path.relative(root, absolutePath)));
      }
    }
  };
  visit(directory);
  return files;
}

export function collectSourceFiles(root = desktopDir) {
  const relativePaths = [
    ...fixedSourceFiles,
    ...sourceDirectories.flatMap((directory) => filesUnder(root, directory)),
  ].sort((left, right) => left.localeCompare(right));

  const duplicate = relativePaths.find((item, index) => relativePaths.indexOf(item) !== index);
  if (duplicate) throw new Error(`Duplicate manifest input: ${duplicate}`);

  return relativePaths.map((relativePath) => {
    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(`${root}${path.sep}`) && absolutePath !== root) {
      throw new Error(`Release input escapes desktop-agent: ${relativePath}`);
    }
    const info = fs.statSync(absolutePath);
    if (!info.isFile()) throw new Error(`Release input is not a file: ${relativePath}`);
    return {
      path: relativePath,
      sha256: sha256File(absolutePath),
      size: info.size,
      packed: packedFixedFiles.has(relativePath) || relativePath.startsWith('src/') || relativePath.startsWith('public/'),
    };
  });
}

function gitCommand(args) {
  try {
    return execFileSync('git', args, {
      cwd: desktopDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

export function gitSnapshot() {
  const commit = gitCommand(['rev-parse', 'HEAD']);
  if (!commit) return { available: false, commit: 'unavailable', dirty: null, root: '' };
  return {
    available: true,
    commit,
    dirty: gitCommand(['status', '--porcelain=v1', '--untracked-files=all']) !== '',
    root: gitCommand(['rev-parse', '--show-toplevel']),
  };
}

function buildTimestamp(value = process.env.TZ_AGENT_BUILD_TIME) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('TZ_AGENT_BUILD_TIME must be an ISO-8601 timestamp');
  return parsed.toISOString();
}

function buildCommit(snapshot, value = process.env.TZ_AGENT_BUILD_COMMIT) {
  const override = String(value || '').trim();
  if (!override) return snapshot.commit;
  if (!/^[0-9a-f]{7,64}$/i.test(override)) throw new Error('TZ_AGENT_BUILD_COMMIT must be a Git SHA');
  return override.toLowerCase();
}

function requireCleanSnapshot(snapshot) {
  if (!snapshot.available) throw new Error('A Git checkout is required for a release build manifest');
  if (snapshot.dirty) throw new Error('Refusing to build from a dirty Git worktree');
}

export function createBuildManifest(options = {}) {
  const root = path.resolve(options.root || desktopDir);
  const snapshot = gitSnapshot();
  if (options.requireClean) requireCleanSnapshot(snapshot);
  const packageJson = readJson(path.join(root, 'package.json'));
  const lockfile = readJson(path.join(root, 'package-lock.json'));
  if (packageJson.version !== lockfile.version || packageJson.version !== lockfile.packages?.['']?.version) {
    throw new Error('package.json and package-lock.json versions must match before building');
  }

  const repoRelativePath = snapshot.root
    ? toPortablePath(path.relative(snapshot.root, root)) || '.'
    : '.';

  return {
    schema_version: 1,
    product: {
      name: packageJson.name,
      version: packageJson.version,
      app_id: packageJson.build?.appId || '',
    },
    source: {
      commit: buildCommit(snapshot, options.commit),
      git_available: snapshot.available,
      dirty: snapshot.dirty,
      repository_path: repoRelativePath,
    },
    build: {
      generated_at: buildTimestamp(options.generatedAt),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    files: collectSourceFiles(root),
  };
}

export function validateBuildManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('manifest must be an object');
  if (manifest?.schema_version !== 1) errors.push('unsupported schema_version');
  if (!/^[\w@./-]+$/.test(String(manifest?.product?.name || ''))) errors.push('product.name is missing');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(manifest?.product?.version || ''))) errors.push('product.version is invalid');
  if (!String(manifest?.source?.commit || '').trim()) errors.push('source.commit is missing');
  if (typeof manifest?.source?.git_available !== 'boolean') errors.push('source.git_available is invalid');
  if (manifest?.source?.dirty !== null && typeof manifest?.source?.dirty !== 'boolean') errors.push('source.dirty is invalid');
  if (Number.isNaN(new Date(String(manifest?.build?.generated_at || '')).getTime())) errors.push('build.generated_at is invalid');
  if (!Array.isArray(manifest?.files) || !manifest.files.length) errors.push('files is empty');

  const paths = new Set();
  for (const file of manifest?.files || []) {
    const relativePath = String(file?.path || '');
    if (!relativePath || relativePath.includes('..') || path.isAbsolute(relativePath) || relativePath.includes('\\')) errors.push(`unsafe file path: ${relativePath || '(empty)'}`);
    if (paths.has(relativePath)) errors.push(`duplicate file path: ${relativePath}`);
    paths.add(relativePath);
    if (!/^[a-f0-9]{64}$/i.test(String(file?.sha256 || ''))) errors.push(`invalid SHA-256: ${relativePath}`);
    if (!Number.isSafeInteger(file?.size) || file.size < 0) errors.push(`invalid size: ${relativePath}`);
    if (typeof file?.packed !== 'boolean') errors.push(`invalid packed flag: ${relativePath}`);
  }

  if (errors.length) throw new Error(`Invalid build manifest: ${errors.join('; ')}`);
  return manifest;
}

export function writeBuildManifest(manifest, outputPath = defaultManifestPath) {
  validateBuildManifest(manifest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, outputPath);
  return outputPath;
}

export function readBuildManifest(filePath = defaultManifestPath) {
  if (!fs.existsSync(filePath)) throw new Error(`Build manifest is missing: ${filePath}`);
  return validateBuildManifest(readJson(filePath));
}

function parseArguments(args) {
  const options = { requireClean: false, output: defaultManifestPath };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--require-clean') options.requireClean = true;
    else if (value === '--output') options.output = path.resolve(args[++index] || '');
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = createBuildManifest({ requireClean: options.requireClean });
  const outputPath = writeBuildManifest(manifest, options.output);
  console.log(`Build manifest written: ${outputPath}`);
  console.log(`Source commit: ${manifest.source.commit}${manifest.source.dirty ? ' (dirty)' : ''}`);
  console.log(`Hashed inputs: ${manifest.files.length}`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(`Build manifest generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
