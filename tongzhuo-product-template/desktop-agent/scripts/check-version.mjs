import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentVersion } from '../src/version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const desktopDir = path.resolve(__dirname, '..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
const product = readJson(path.join(rootDir, 'product.json'));
const packageJson = readJson(path.join(desktopDir, 'package.json'));
const packageLock = readJson(path.join(desktopDir, 'package-lock.json'));

assert.equal(agentVersion, product.version);
assert.equal(packageJson.version, agentVersion);
assert.equal(packageLock.version, agentVersion);
assert.equal(packageLock.packages[''].version, agentVersion);

console.log('Version consistency passed.');
