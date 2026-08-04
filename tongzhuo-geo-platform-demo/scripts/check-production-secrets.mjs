import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AiProviderStore } from "../ai-provider-store.mjs";
import { ProductionSecrets, secretDigest, verifySecret } from "../production-secrets.mjs";
import { PublisherStore } from "../publisher-store.mjs";

function legacyEncrypt(secret, material) {
  const key = crypto.createHash("sha256").update(material, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-production-secrets-"));

try {
  const generatedKeyDir = path.join(temporaryRoot, "generated-key");
  const generatedSecrets = new ProductionSecrets({ dataDir: generatedKeyDir, environmentValue: "" });
  await generatedSecrets.load();
  const generatedKey = await readFile(path.join(generatedKeyDir, "secrets", "master.key"));
  assert.equal(generatedKey.length, 32);

  const envelopePlaintext = "regression-envelope-secret";
  const envelope = generatedSecrets.encryptSecret(envelopePlaintext, "regression-envelope");
  assert.equal(envelope.version, 1);
  assert.equal(envelope.algorithm, "aes-256-gcm");
  assert.equal(typeof envelope.iv, "string");
  assert.equal(typeof envelope.tag, "string");
  assert.equal(typeof envelope.ciphertext, "string");
  assert.equal(JSON.stringify(envelope).includes(envelopePlaintext), false);
  assert.equal(generatedSecrets.decryptSecret(envelope, "regression-envelope"), envelopePlaintext);
  assert.throws(() => generatedSecrets.decryptSecret(envelope, "wrong-context"), /无法解密/);

  const digestSecret = "regression-digest-secret";
  const digest = secretDigest(digestSecret);
  assert.equal(digest.includes(digestSecret), false);
  assert.equal(verifySecret(digestSecret, digest), true);
  assert.equal(verifySecret("wrong-secret", digest), false);

  const aiDataDir = path.join(temporaryRoot, "ai");
  await mkdir(aiDataDir, { recursive: true });
  const plaintextApiKey = "sk-regression-plaintext-123456";
  const legacyApiKey = "sk-regression-legacy-654321";
  const legacyKeyMaterial = "regression-only-legacy-key-material";
  await writeFile(path.join(aiDataDir, "ai-providers.json"), JSON.stringify({
    schemaVersion: 1,
    providers: [
      {
        id: "plaintext-provider",
        name: "Plaintext migration",
        baseUrl: "https://example.invalid/v1",
        model: "test-model",
        apiKey: plaintextApiKey
      },
      {
        id: "legacy-provider",
        name: "Legacy encrypted migration",
        baseUrl: "https://example.invalid/v1",
        model: "test-model",
        apiKeyEncrypted: legacyEncrypt(legacyApiKey, legacyKeyMaterial)
      }
    ]
  }, null, 2), "utf8");

  const masterKey = Buffer.alloc(32, 0x5a);
  const aiStore = new AiProviderStore({ dataDir: aiDataDir, masterKey, encryptionKey: legacyKeyMaterial });
  await aiStore.load();
  assert.equal(aiStore.find("plaintext-provider")?.apiKey, plaintextApiKey);
  assert.equal(aiStore.find("legacy-provider")?.apiKey, legacyApiKey);
  assert.equal(JSON.stringify(aiStore.list()).includes(plaintextApiKey), false);
  assert.equal(JSON.stringify(aiStore.list()).includes(legacyApiKey), false);

  const migratedAiJson = await readFile(path.join(aiDataDir, "ai-providers.json"), "utf8");
  assert.equal(migratedAiJson.includes(plaintextApiKey), false);
  assert.equal(migratedAiJson.includes(legacyApiKey), false);
  const migratedProviders = JSON.parse(migratedAiJson).providers;
  migratedProviders.forEach((provider) => {
    assert.equal(Object.prototype.hasOwnProperty.call(provider, "apiKey"), false);
    assert.equal(typeof provider.apiKeyEncrypted, "object");
    assert.equal(provider.apiKeyEncrypted.version, 1);
    assert.equal(typeof provider.apiKeyEncrypted.iv, "string");
    assert.equal(typeof provider.apiKeyEncrypted.tag, "string");
    assert.equal(typeof provider.apiKeyEncrypted.ciphertext, "string");
  });

  const reloadedAiStore = new AiProviderStore({ dataDir: aiDataDir, masterKey });
  await reloadedAiStore.load();
  assert.equal(reloadedAiStore.find("plaintext-provider")?.apiKey, plaintextApiKey);
  assert.equal(reloadedAiStore.find("legacy-provider")?.apiKey, legacyApiKey);

  const publisherDataDir = path.join(temporaryRoot, "publisher");
  await mkdir(publisherDataDir, { recursive: true });
  const legacyDeviceToken = "pub-regression-legacy-device-token";
  const legacyDeviceSecret = "regression-legacy-device-secret";
  await writeFile(path.join(publisherDataDir, "publisher-state.json"), JSON.stringify({
    version: 1,
    nextJobId: 1,
    pairings: [],
    jobs: [],
    devices: [{
      id: "legacy-device",
      name: "Legacy device",
      status: "online",
      token: legacyDeviceToken,
      deviceSecret: legacyDeviceSecret,
      capabilities: [],
      accountGroups: [],
      sessions: {}
    }]
  }, null, 2), "utf8");

  const publisherStore = new PublisherStore({ dataDir: publisherDataDir });
  await publisherStore.load();
  assert.equal(publisherStore.authenticate({
    authorization: `Bearer ${legacyDeviceToken}`,
    "x-publisher-worker": "legacy-device"
  }).id, "legacy-device");
  assert.equal(publisherStore.authenticate({
    authorization: `Bearer ${legacyDeviceSecret}`,
    "x-publisher-worker": "legacy-device"
  }).id, "legacy-device");
  assert.throws(() => publisherStore.authenticate({
    authorization: "Bearer wrong-token",
    "x-publisher-worker": "legacy-device"
  }), /尚未完成配对/);

  let persistedPublisherJson = await readFile(path.join(publisherDataDir, "publisher-state.json"), "utf8");
  assert.equal(persistedPublisherJson.includes(legacyDeviceToken), false);
  assert.equal(persistedPublisherJson.includes(legacyDeviceSecret), false);
  const migratedDevice = JSON.parse(persistedPublisherJson).devices[0];
  assert.equal(Object.prototype.hasOwnProperty.call(migratedDevice, "token"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(migratedDevice, "deviceSecret"), false);
  assert.equal(typeof migratedDevice.tokenDigest, "string");
  assert.equal(typeof migratedDevice.deviceSecretDigest, "string");

  const pairing = await publisherStore.createPairing();
  const requestedDeviceSecret = "regression-new-device-secret";
  const registration = await publisherStore.register({
    pairing_code: pairing.code,
    device_id: "new-device",
    device_secret: requestedDeviceSecret,
    name: "New device"
  });
  assert.equal(registration.device_secret, requestedDeviceSecret);
  assert.equal(typeof registration.pairing_token, "string");
  assert.equal(registration.pairing_token.length > 50, true);

  persistedPublisherJson = await readFile(path.join(publisherDataDir, "publisher-state.json"), "utf8");
  assert.equal(persistedPublisherJson.includes(requestedDeviceSecret), false);
  assert.equal(persistedPublisherJson.includes(registration.pairing_token), false);
  assert.equal(publisherStore.authenticate({
    authorization: `Bearer ${registration.pairing_token}`,
    "x-publisher-worker": "new-device"
  }).id, "new-device");
  assert.equal(publisherStore.authenticate({
    authorization: `Bearer ${requestedDeviceSecret}`,
    "x-publisher-worker": "new-device"
  }).id, "new-device");

  console.log("production secrets check passed");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

