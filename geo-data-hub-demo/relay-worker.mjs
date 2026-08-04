import crypto from "node:crypto";
import { AidsoClientError } from "./aidso-client.mjs";
import { RelayStoreError } from "./relay-store.mjs";

const DEFAULTS = Object.freeze({
  claimLimit: 12,
  concurrency: 4,
  leaseMs: 90_000,
  intervalMs: 5_000,
  submitMaxAttempts: 3,
  pollMaxAttempts: 12,
  submitRetryBaseMs: 15_000,
  pollInitialDelayMs: 15_000,
  pollRetryBaseMs: 15_000,
  retryCapMs: 120_000
});

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(1, Math.min(maximum, number));
}

function nonNegativeInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(0, Math.min(maximum, number));
}

function nextDelay(attemptNo, baseMs, capMs) {
  const exponent = Math.max(0, Number(attemptNo || 1) - 1);
  return Math.min(capMs, baseMs * (2 ** Math.min(exponent, 12)));
}

function asProviderError(error) {
  if (error instanceof AidsoClientError) return error;
  return new AidsoClientError("RELAY_WORKER_UNEXPECTED", error?.message || "中转 Worker 执行异常。", {
    retryable: false,
    submissionUncertain: false,
    cause: error
  });
}

export class RelayWorker {
  constructor(options = {}) {
    if (!options.store) throw new TypeError("RelayWorker requires a RelayStore instance.");
    if (!options.providerClient && !options.aidsoClient) throw new TypeError("RelayWorker requires an AIDSO client.");
    this.store = options.store;
    this.providerClient = options.providerClient || options.aidsoClient;
    this.workerId = String(options.workerId || `relay-worker-${crypto.randomUUID().slice(0, 8)}`).trim();
    this.options = {
      claimLimit: positiveInteger(options.claimLimit, DEFAULTS.claimLimit, 100),
      concurrency: positiveInteger(options.concurrency, DEFAULTS.concurrency, 32),
      leaseMs: positiveInteger(options.leaseMs, DEFAULTS.leaseMs, 15 * 60_000),
      intervalMs: positiveInteger(options.intervalMs, DEFAULTS.intervalMs, 60_000),
      submitMaxAttempts: positiveInteger(options.submitMaxAttempts, DEFAULTS.submitMaxAttempts, 100),
      pollMaxAttempts: positiveInteger(options.pollMaxAttempts, DEFAULTS.pollMaxAttempts, 100),
      submitRetryBaseMs: nonNegativeInteger(options.submitRetryBaseMs, DEFAULTS.submitRetryBaseMs, 3_600_000),
      pollInitialDelayMs: nonNegativeInteger(options.pollInitialDelayMs, DEFAULTS.pollInitialDelayMs, 3_600_000),
      pollRetryBaseMs: nonNegativeInteger(options.pollRetryBaseMs, DEFAULTS.pollRetryBaseMs, 3_600_000),
      retryCapMs: positiveInteger(options.retryCapMs, DEFAULTS.retryCapMs, 24 * 60 * 60_000)
    };
    this.timer = null;
    this.inFlightTick = null;
    this.acceptingTicks = false;
    this.stopping = false;
    this.startedAt = null;
    this.lastTickStartedAt = null;
    this.lastTickFinishedAt = null;
    this.lastTickErrorCode = null;
    this.onError = typeof options.onError === "function" ? options.onError : null;
  }

  _after(delayMs, now = new Date()) {
    return new Date(now.valueOf() + Math.max(0, delayMs)).toISOString();
  }

  async _handleFailure(claim, attempt, error) {
    const providerError = asProviderError(error);
    const isSubmit = claim.operation === "submit";
    const attempts = attempt.attemptNo;
    const retryDelay = nextDelay(
      attempts,
      isSubmit ? this.options.submitRetryBaseMs : this.options.pollRetryBaseMs,
      this.options.retryCapMs
    );
    // A non-AIDSO error after a POST intent was recorded cannot prove that the
    // provider did not receive the request. Keep the customer reservation held.
    const submissionUncertain = isSubmit && (providerError.submissionUncertain || !(error instanceof AidsoClientError));
    const retryable = !submissionUncertain && Boolean(providerError.retryable);
    const maxAttempts = isSubmit ? this.options.submitMaxAttempts : this.options.pollMaxAttempts;
    return this.store.recordItemFailure({
      relayItemId: claim.relayItemId,
      attemptId: attempt.attemptId,
      workerId: this.workerId,
      retryable,
      submissionUncertain,
      maxAttempts,
      nextActionAt: this._after(retryDelay),
      providerStatus: providerError.providerStatus,
      latencyMs: providerError.details?.latencyMs,
      error: { code: providerError.code, message: providerError.message }
    });
  }

  async _processClaim(claim) {
    const attempt = this.store.beginItemAttempt({
      relayItemId: claim.relayItemId,
      workerId: this.workerId,
      operation: claim.operation
    });
    try {
      if (claim.operation === "submit") {
        const result = await this.providerClient.submit(claim);
        return this.store.recordItemSubmitted({
          relayItemId: claim.relayItemId,
          attemptId: attempt.attemptId,
          workerId: this.workerId,
          upstreamReqId: result.reqId,
          rawResponse: result.raw,
          providerStatus: result.providerStatus,
          latencyMs: result.latencyMs,
          nextActionAt: this._after(this.options.pollInitialDelayMs)
        });
      }
      const result = await this.providerClient.poll(claim.upstreamReqId, { brand: claim.brand });
      if (result.state === "pending") {
        return this.store.recordItemPollPending({
          relayItemId: claim.relayItemId,
          attemptId: attempt.attemptId,
          workerId: this.workerId,
          rawResponse: result.raw,
          providerStatus: result.providerStatus,
          latencyMs: result.latencyMs,
          nextActionAt: this._after(nextDelay(attempt.attemptNo, this.options.pollRetryBaseMs, this.options.retryCapMs))
        });
      }
      if (result.state !== "completed") {
        throw new AidsoClientError("AIDSO_INVALID_POLL_STATE", "爱搜适配器返回了未知轮询状态。", { retryable: true, providerStatus: result.providerStatus });
      }
      return this.store.recordItemCompleted({
        relayItemId: claim.relayItemId,
        attemptId: attempt.attemptId,
        workerId: this.workerId,
        rawPayload: result.raw,
        normalized: result.normalized,
        normalizerVersion: result.normalized?.normalizerVersion,
        observedAt: result.normalized?.observedAt,
        upstreamCredits: result.upstreamCredits,
        providerStatus: result.providerStatus,
        latencyMs: result.latencyMs
      });
    } catch (error) {
      // If storing a successful submit response fails, leaving the persisted
      // running attempt untouched is intentional: lease recovery marks it
      // submission_uncertain instead of creating a duplicate AIDSO task.
      if (error instanceof RelayStoreError && ["RELAY_LEASE_LOST", "RELAY_ATTEMPT_CONFLICT"].includes(error.code)) throw error;
      return this._handleFailure(claim, attempt, error);
    }
  }

  async tick(options = {}) {
    if (this.inFlightTick) return this.inFlightTick;
    // A manual test tick may explicitly opt in during shutdown, but ordinary
    // timer/wake activity must not claim new work once the process drains.
    if (this.stopping && !options.allowWhenStopped) {
      return { workerId: this.workerId, claimed: 0, outcomes: [], skipped: "stopped" };
    }
    this.lastTickStartedAt = new Date().toISOString();
    this.inFlightTick = this._tick(options)
      .catch((error) => {
        this.lastTickErrorCode = String(error?.code || "RELAY_WORKER_ERROR");
        throw error;
      })
      .finally(() => {
        this.lastTickFinishedAt = new Date().toISOString();
        this.inFlightTick = null;
      });
    return this.inFlightTick;
  }

  wake() {
    if (!this.acceptingTicks) return;
    this.tick().catch((error) => {
      if (this.onError) this.onError(error, null);
    });
  }

  async legacyTestProvider() {
    const mode = this.providerClient?.constructor?.name === "MockAidsoClient" ? "mock" : "live";
    return {
      status: mode === "mock" ? "mock" : "healthy",
      mode,
      workerId: this.workerId,
      message: mode === "mock" ? "本地模拟爱搜适配器可用；配置 AIDSO_TOKEN 后启用真实 OpenAPI。" : "爱搜 OpenAPI 适配器已配置。"
    };
  }

  async probeProvider() {
    const state = typeof this.providerClient?.getProviderState === "function"
      ? this.providerClient.getProviderState()
      : {
          providerAccountId: "",
          mode: this.providerClient?.constructor?.name === "MockAidsoClient" ? "mock" : "real",
          status: "unknown",
          tokenConfigured: null
        };
    let result;
    try {
      result = typeof this.providerClient?.probe === "function"
        ? await this.providerClient.probe()
        : {
            status: state.mode === "mock" ? "mock" : "healthy",
            mode: state.mode,
            providerStatus: state.mode === "mock" ? "MOCK" : "CONFIGURED",
            latencyMs: null,
            message: state.mode === "mock" ? "本地模拟爱搜适配器可用。" : "爱搜 OpenAPI 适配器已配置。"
          };
    } catch (error) {
      result = {
        status: "unavailable",
        mode: state.mode,
        providerStatus: error?.code || "PROBE_FAILED",
        latencyMs: error?.details?.latencyMs || null,
        message: error?.message || "爱搜探针失败。"
      };
    }
    const providerAccountId = state.providerAccountId;
    if (providerAccountId && typeof this.store.setProviderHealth === "function") {
      try {
        this.store.setProviderHealth(providerAccountId, {
          status: result.status,
          lastKnownBalance: result.balance
        });
      } catch {
        // Health telemetry must not turn a successful probe into an API error.
      }
    }
    return { ...result, workerId: this.workerId, providerAccountId };
  }

  // Keep the public admin API method name stable while using the real probe.
  async testProvider() {
    try {
      return await this.probeProvider();
    } catch (error) {
      return {
        status: "unavailable",
        mode: "real",
        providerStatus: error?.code || "PROBE_FAILED",
        latencyMs: error?.details?.latencyMs || null,
        message: error?.message || "爱搜探针失败。",
        workerId: this.workerId,
        providerAccountId: ""
      };
    }
  }

  async _tick(options = {}) {
    const claims = this.store.claimWork({
      workerId: this.workerId,
      limit: positiveInteger(options.limit, this.options.claimLimit, 100),
      leaseMs: positiveInteger(options.leaseMs, this.options.leaseMs, 15 * 60_000),
      now: options.now
    });
    const outcomes = [];
    for (let offset = 0; offset < claims.length; offset += this.options.concurrency) {
      const batch = claims.slice(offset, offset + this.options.concurrency);
      const settled = await Promise.allSettled(batch.map((claim) => this._processClaim(claim)));
      for (let index = 0; index < settled.length; index += 1) {
        const result = settled[index];
        if (result.status === "fulfilled") outcomes.push({ relayItemId: batch[index].relayItemId, ok: true, result: result.value });
        else {
          outcomes.push({ relayItemId: batch[index].relayItemId, ok: false, error: { code: result.reason?.code || "RELAY_WORKER_ERROR", message: result.reason?.message || "Worker 执行失败。" } });
          if (this.onError) this.onError(result.reason, batch[index]);
        }
      }
    }
    return { workerId: this.workerId, claimed: claims.length, outcomes };
  }

  start() {
    if (this.timer || this.acceptingTicks) return this;
    this.stopping = false;
    this.acceptingTicks = true;
    this.startedAt = this.startedAt || new Date().toISOString();
    const run = () => {
      this.tick().catch((error) => {
        if (this.onError) this.onError(error, null);
      });
    };
    run();
    this.timer = setInterval(run, this.options.intervalMs);
    this.timer.unref?.();
    return this;
  }

  stop() {
    this.acceptingTicks = false;
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this.inFlightTick;
  }

  getHealth() {
    return {
      workerId: this.workerId,
      acceptingTicks: this.acceptingTicks,
      stopping: this.stopping,
      timerActive: Boolean(this.timer),
      inFlight: Boolean(this.inFlightTick),
      startedAt: this.startedAt,
      lastTickStartedAt: this.lastTickStartedAt,
      lastTickFinishedAt: this.lastTickFinishedAt,
      lastTickErrorCode: this.lastTickErrorCode
    };
  }

  /** Stop timer-driven claims and wait only for an already-running tick. */
  async waitForInFlight(options = {}) {
    const timeoutMs = positiveInteger(options.timeoutMs, 20_000, 300_000);
    const active = this.stop();
    if (!active) return { drained: true, timedOut: false };
    let timer;
    try {
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
        timer.unref?.();
      });
      const result = await Promise.race([
        active.then(() => ({ timedOut: false }), () => ({ timedOut: false })),
        timeout
      ]);
      return { drained: !result.timedOut, timedOut: result.timedOut };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async drain(options = {}) {
    const maxTicks = positiveInteger(options.maxTicks, 100, 10_000);
    const outcomes = [];
    for (let index = 0; index < maxTicks; index += 1) {
      const result = await this.tick({ ...options, allowWhenStopped: true });
      outcomes.push(result);
      if (!result.claimed) return { drained: true, ticks: outcomes };
    }
    return { drained: false, ticks: outcomes };
  }
}

export function createRelayWorker(options = {}) {
  return new RelayWorker(options);
}
