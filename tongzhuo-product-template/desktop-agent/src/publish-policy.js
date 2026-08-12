// Runtime safeguards for unattended publishing.
//
// The policy is deliberately independent from the browser adapter so it can be
// exercised with a deterministic clock/random source in repository checks. It
// keeps only small counters and timestamps; task payloads/results remain owned
// by the agent and server.

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.trunc(finiteNumber(value, fallback));
  return Math.min(max, Math.max(min, number));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function dayKey(now) {
  return new Date(now).toISOString().slice(0, 10);
}

export const defaultPublishPolicy = Object.freeze({
  maxConcurrentGroups: 2,
  defaultDailyQuota: 5,
  defaultMinDelaySeconds: 20,
  defaultMaxDelaySeconds: 60,
  riskPauseThreshold: 2,
  riskPauseMinutes: 24 * 60,
});

/**
 * Tracks concurrency, daily quotas and risk cooldowns for automatic jobs.
 * `state` is intentionally JSON serialisable and can be persisted by callers.
 */
export class PublishPolicy {
  constructor(options = {}) {
    const policy = { ...defaultPublishPolicy, ...asObject(options.policy) };
    this.policy = {
      maxConcurrentGroups: positiveInteger(policy.maxConcurrentGroups, defaultPublishPolicy.maxConcurrentGroups, 1, 32),
      defaultDailyQuota: positiveInteger(policy.defaultDailyQuota, defaultPublishPolicy.defaultDailyQuota, 0, 10000),
      defaultMinDelaySeconds: Math.max(0, finiteNumber(policy.defaultMinDelaySeconds, defaultPublishPolicy.defaultMinDelaySeconds)),
      defaultMaxDelaySeconds: Math.max(0, finiteNumber(policy.defaultMaxDelaySeconds, defaultPublishPolicy.defaultMaxDelaySeconds)),
      riskPauseThreshold: positiveInteger(policy.riskPauseThreshold, defaultPublishPolicy.riskPauseThreshold, 1, 100),
      riskPauseMinutes: Math.max(1, finiteNumber(policy.riskPauseMinutes, defaultPublishPolicy.riskPauseMinutes)),
    };
    if (this.policy.defaultMaxDelaySeconds < this.policy.defaultMinDelaySeconds) {
      this.policy.defaultMaxDelaySeconds = this.policy.defaultMinDelaySeconds;
    }
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.sleep = typeof options.sleep === 'function'
      ? options.sleep
      : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    this.state = this.normalizeState(options.state);
  }

  normalizeState(value) {
    const source = asObject(value);
    const day = dayKey(this.now());
    const usage = asObject(source.dailyUsage);
    const normalizedUsage = {};
    for (const [key, entry] of Object.entries(usage)) {
      const item = asObject(entry);
      if (String(item.day || key).slice(0, 10) !== day) continue;
      normalizedUsage[key] = {
        day,
        count: Math.max(0, Math.trunc(finiteNumber(item.count, 0))),
      };
    }
    const cooldowns = {};
    for (const [key, entry] of Object.entries(asObject(source.cooldowns))) {
      const item = asObject(entry);
      const until = Math.max(0, Math.trunc(finiteNumber(item.until, 0)));
      if (until > this.now()) {
        cooldowns[key] = {
          until,
          riskCount: Math.max(0, Math.trunc(finiteNumber(item.riskCount, 0))),
          reason: String(item.reason || 'risk_control'),
        };
      }
    }
    return {
      dailyUsage: normalizedUsage,
      cooldowns,
      activeProfiles: {},
      activeGroups: {},
    };
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  get maxConcurrentGroups() {
    return this.policy.maxConcurrentGroups;
  }

  profileKey(groupId, platformId, explicitProfileKey = '') {
    return String(explicitProfileKey || `${groupId || 'group-default'}--${platformId || 'platform'}`).trim();
  }

  policyFor(platformId, platformPolicy = {}) {
    const root = asObject(platformPolicy);
    const item = asObject(root[platformId]);
    const quota = item.daily_quota ?? item.dailyQuota ?? root.daily_quota ?? root.dailyQuota;
    const min = item.min_delay_seconds ?? item.minDelaySeconds ?? root.min_delay_seconds ?? root.minDelaySeconds;
    const max = item.max_delay_seconds ?? item.maxDelaySeconds ?? root.max_delay_seconds ?? root.maxDelaySeconds;
    return {
      dailyQuota: Math.max(0, Math.trunc(finiteNumber(quota, this.policy.defaultDailyQuota))),
      minDelaySeconds: Math.max(0, finiteNumber(min, this.policy.defaultMinDelaySeconds)),
      maxDelaySeconds: Math.max(0, finiteNumber(max, this.policy.defaultMaxDelaySeconds)),
      riskPauseThreshold: positiveInteger(item.risk_pause_threshold ?? item.riskPauseThreshold, this.policy.riskPauseThreshold, 1, 100),
      riskPauseMinutes: Math.max(1, finiteNumber(item.risk_pause_minutes ?? item.riskPauseMinutes, this.policy.riskPauseMinutes)),
    };
  }

  activeCount() {
    return Object.keys(this.state.activeGroups).length;
  }

  canStartGroup(groupId = 'group-default', automatic = true) {
    const group = String(groupId || 'group-default');
    if (!automatic) return { allowed: true, reason: null, groupId: group };
    if (this.state.activeGroups[group]) return { allowed: false, reason: 'group_busy', groupId: group };
    if (this.activeCount() >= this.policy.maxConcurrentGroups) return { allowed: false, reason: 'concurrency_limit', groupId: group };
    return { allowed: true, reason: null, groupId: group };
  }

  acquireGroup(groupId = 'group-default', automatic = true) {
    const result = this.canStartGroup(groupId, automatic);
    if (!result.allowed) return result;
    this.state.activeGroups[result.groupId] = 1;
    return result;
  }

  releaseGroup(groupId = 'group-default') {
    delete this.state.activeGroups[String(groupId || 'group-default')];
  }

  canStartProfile({ groupId, profileKey, platformId, platformPolicy, automatic = true } = {}) {
    const group = String(groupId || 'group-default');
    const profile = this.profileKey(group, platformId, profileKey);
    if (!automatic) return { allowed: true, reason: null, groupId: group, profileKey: profile };
    if (this.state.activeProfiles[profile]) return { allowed: false, reason: 'profile_busy', groupId: group, profileKey: profile };
    const cooldown = this.state.cooldowns[String(platformId || '')];
    const now = this.now();
    if (cooldown && cooldown.until > now) return { allowed: false, reason: 'risk_cooldown', platformId, cooldownUntil: new Date(cooldown.until).toISOString() };
    const quota = this.policyFor(platformId, platformPolicy).dailyQuota;
    const used = this.state.dailyUsage[String(platformId || '')]?.count || 0;
    if (quota >= 0 && used >= quota) return { allowed: false, reason: 'daily_quota_exhausted', platformId, quota, used };
    return { allowed: true, reason: null, groupId: group, profileKey: profile };
  }

  acquireProfile(options = {}) {
    const result = this.canStartProfile(options);
    if (!result.allowed) return result;
    this.state.activeProfiles[result.profileKey] = {
      groupId: result.groupId,
      platformId: String(options.platformId || ''),
      acquiredAt: this.now(),
    };
    return result;
  }

  releaseProfile({ groupId, profileKey, platformId } = {}) {
    delete this.state.activeProfiles[this.profileKey(groupId, platformId, profileKey)];
  }

  canStart({ groupId, profileKey, platformId, platformPolicy, automatic = true } = {}) {
    if (!automatic) return { allowed: true, reason: null };
    const profileResult = this.canStartProfile({ groupId, profileKey, platformId, platformPolicy, automatic });
    if (!profileResult.allowed) return profileResult;
    if (!this.state.activeGroups[String(groupId || 'group-default')] && this.activeCount() >= this.policy.maxConcurrentGroups) {
      return { allowed: false, reason: 'concurrency_limit', groupId: profileResult.groupId, profileKey: profileResult.profileKey };
    }
    return profileResult;
  }

  acquire({ groupId, profileKey, platformId, platformPolicy, automatic = true } = {}) {
    const groupResult = this.acquireGroup(groupId, automatic);
    if (!groupResult.allowed) return groupResult;
    const profileResult = this.acquireProfile({ groupId, profileKey, platformId, platformPolicy, automatic });
    if (!profileResult.allowed) {
      this.releaseGroup(groupId);
      return profileResult;
    }
    return profileResult;
  }

  release({ groupId, profileKey, platformId } = {}) {
    this.releaseProfile({ groupId, profileKey, platformId });
    this.releaseGroup(groupId);
  }

  recordSuccess(platformId, count = 1) {
    const key = String(platformId || '').trim();
    if (!key) return;
    const today = dayKey(this.now());
    const entry = this.state.dailyUsage[key];
    if (!entry || entry.day !== today) this.state.dailyUsage[key] = { day: today, count: 0 };
    this.state.dailyUsage[key].count += Math.max(0, Math.trunc(finiteNumber(count, 1)));
    // A successful run clears the consecutive risk strike, but does not erase
    // an active cooldown until its expiry.
    if (this.state.cooldowns[key] && this.state.cooldowns[key].until <= this.now()) delete this.state.cooldowns[key];
  }

  recordRisk(platformId, reason = 'risk_control', platformPolicy = {}) {
    const key = String(platformId || '').trim();
    if (!key) return null;
    const current = this.state.cooldowns[key] || { riskCount: 0, until: 0 };
    const settings = this.policyFor(key, platformPolicy);
    const riskCount = current.riskCount + 1;
    const shouldPause = riskCount >= settings.riskPauseThreshold;
    const until = shouldPause ? this.now() + settings.riskPauseMinutes * 60 * 1000 : 0;
    this.state.cooldowns[key] = { riskCount, until, reason: String(reason || 'risk_control') };
    return this.state.cooldowns[key];
  }

  delayMs(platformId, platformPolicy = {}) {
    const settings = this.policyFor(platformId, platformPolicy);
    const min = settings.minDelaySeconds;
    const max = Math.max(min, settings.maxDelaySeconds);
    if (max <= 0) return 0;
    const random = Math.min(1, Math.max(0, finiteNumber(this.random(), 0)));
    return Math.round((min + ((max - min) * random)) * 1000);
  }

  async waitBeforePublish(platformId, platformPolicy = {}, options = {}) {
    if (options.automatic === false || options.skipDelay) return 0;
    const milliseconds = this.delayMs(platformId, platformPolicy);
    if (milliseconds > 0) await this.sleep(milliseconds);
    return milliseconds;
  }

  shouldRetry(errorOrResult) {
    const text = String(errorOrResult?.message || errorOrResult?.error_message || errorOrResult?.state || errorOrResult || '');
    return !/(captcha|verification|verify|login|required|risk|forbidden|unauthori[sz]ed|风控|验证码|登录)/i.test(text);
  }

  recordOutcome(platformId, result, platformPolicy = {}) {
    const state = String(result?.state || '').toLowerCase();
    const message = String(result?.message || result?.error_message || '');
    const risk = /(captcha|verification|verify|risk|forbidden|unauthori[sz]ed|风控|验证码|安全)/i.test(`${state} ${message}`);
    if (risk) this.recordRisk(platformId, message || state, platformPolicy);
    else if (['published', 'draft_saved'].includes(state)) this.recordSuccess(platformId);
    return { risk, retryable: !risk && this.shouldRetry(result) };
  }
}
export function createPublishPolicy(options = {}) {
  return new PublishPolicy(options);
}
