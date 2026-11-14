import { CACHE_TTL_MS, GUMROAD_PRODUCT_ID, GUMROAD_VERIFY_URL, OFFLINE_GRACE_MS } from "./constants";
import type { LicenseCache } from "./settings";

export type LicenseReason =
  | "active"
  | "missing"
  | "invalid"
  | "refunded"
  | "chargebacked"
  | "cancelled"
  | "ended"
  | "inactive"
  | "offline"
  | "unconfigured";

export interface LicenseDecision {
  valid: boolean;
  reason: LicenseReason;
  message: string;
  source: "network" | "cache" | "offline-grace" | "none";
  checkedAt: number | null;
}

const CALENDAR_OK = "The calendar still works.";

function decision(
  valid: boolean,
  reason: LicenseReason,
  message: string,
  source: LicenseDecision["source"],
  checkedAt: number | null,
): LicenseDecision {
  return { valid, reason, message, source, checkedAt };
}

export function isCacheFresh(cache: LicenseCache | null, key: string, now: number): boolean {
  if (!cache || cache.key !== key) return false;
  return now - cache.checkedAt < CACHE_TTL_MS;
}

function fromCache(cache: LicenseCache, source: LicenseDecision["source"]): LicenseDecision {
  return decision(cache.valid, cache.reason as LicenseReason, cache.message, source, cache.checkedAt);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "" && value.trim().toLowerCase() !== "null";
  return Boolean(value);
}

function isFutureTimestamp(value: unknown, now: number): boolean {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed > now;
}

/**
 * A license is active only when Gumroad accepts the key and the purchase is not
 * refunded, chargebacked, disputed, cancelled, or ended.
 * `subscription_ended_at` in the future is a fixed term that has not finished.
 * `subscription_cancelled_at` turns Pro off as soon as Gumroad sets it.
 */
export function interpretGumroad(body: unknown, now: number): Omit<LicenseDecision, "source" | "checkedAt"> {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      reason: "invalid",
      message: `This license key is not valid. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  const record = body as Record<string, unknown>;
  if (record.placeholder === true) {
    return {
      valid: false,
      reason: "unconfigured",
      message: `License checks are not configured yet (the Gumroad product id is still a placeholder). Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (record.success !== true) {
    return {
      valid: false,
      reason: "invalid",
      message: `This license key is not valid. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  const purchase = record.purchase;
  if (!purchase || typeof purchase !== "object") {
    return {
      valid: false,
      reason: "invalid",
      message: `This license key is not valid. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  const sale = purchase as Record<string, unknown>;
  if (sale.refunded === true) {
    return {
      valid: false,
      reason: "refunded",
      message: `This license was refunded. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (sale.chargebacked === true) {
    return {
      valid: false,
      reason: "chargebacked",
      message: `This license was chargebacked. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (sale.disputed === true && sale.dispute_won !== true) {
    return {
      valid: false,
      reason: "chargebacked",
      message: `This purchase is disputed. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (isPresent(sale.subscription_cancelled_at)) {
    return {
      valid: false,
      reason: "cancelled",
      message: `This subscription is cancelled. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (isPresent(sale.subscription_failed_at)) {
    return {
      valid: false,
      reason: "inactive",
      message: `This subscription is not active. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  if (isPresent(sale.subscription_ended_at) && !isFutureTimestamp(sale.subscription_ended_at, now)) {
    return {
      valid: false,
      reason: "ended",
      message: `This subscription has ended. Pro is unavailable. ${CALENDAR_OK}`,
    };
  }
  return { valid: true, reason: "active", message: "License active. Pro reviews are unlocked." };
}

export function offlineDecision(cache: LicenseCache | null, key: string, now: number): LicenseDecision {
  if (cache && cache.key === key && cache.valid && now - cache.checkedAt < OFFLINE_GRACE_MS) {
    return decision(
      true,
      "active",
      "Offline. Pro stays available for 14 days after the last successful license check. The calendar does not need a connection.",
      "offline-grace",
      cache.checkedAt,
    );
  }
  if (cache && cache.key === key && !cache.valid && now - cache.checkedAt < OFFLINE_GRACE_MS) {
    return fromCache(cache, "cache");
  }
  return decision(
    false,
    "offline",
    `Could not reach Gumroad to check the license, and there is no successful check from the last 14 days. Pro is unavailable. ${CALENDAR_OK}`,
    "none",
    cache?.checkedAt ?? null,
  );
}

export interface LicenseRequest {
  url: string;
  method: "POST";
  body: string;
}

export function licenseRequestBody(productId: string, licenseKey: string): string {
  return new URLSearchParams({
    product_id: productId,
    license_key: licenseKey,
    increment_uses_count: "false",
  }).toString();
}

export type LicensePlan =
  | { kind: "decision"; decision: LicenseDecision; nextCache: LicenseCache | null }
  | { kind: "fetch"; request: LicenseRequest };

export function planLicenseFetch(input: {
  now: number;
  key: string;
  cache: LicenseCache | null;
  force: boolean;
  productId?: string;
}): LicensePlan {
  const key = input.key.trim();
  const productId = input.productId ?? GUMROAD_PRODUCT_ID;
  if (!key) {
    return {
      kind: "decision",
      decision: decision(
        false,
        "missing",
        `Enter a license key to use Pro. ${CALENDAR_OK}`,
        "none",
        null,
      ),
      nextCache: null,
    };
  }
  if (productId === "PRODUCT_ID_PLACEHOLDER") {
    const interpreted = interpretGumroad({ success: false, placeholder: true }, input.now);
    return {
      kind: "decision",
      decision: { ...interpreted, source: "none", checkedAt: null },
      nextCache: input.cache,
    };
  }
  if (!input.force && isCacheFresh(input.cache, key, input.now)) {
    return {
      kind: "decision",
      decision: fromCache(input.cache as LicenseCache, "cache"),
      nextCache: input.cache,
    };
  }
  return {
    kind: "fetch",
    request: {
      url: GUMROAD_VERIFY_URL,
      method: "POST",
      body: licenseRequestBody(productId, key),
    },
  };
}

export function finishLicenseFetch(
  input: { now: number; key: string; cache: LicenseCache | null },
  outcome: { ok: true; body: unknown } | { ok: false },
): { decision: LicenseDecision; nextCache: LicenseCache | null } {
  const key = input.key.trim();
  if (!outcome.ok) {
    return { decision: offlineDecision(input.cache, key, input.now), nextCache: input.cache };
  }
  const interpreted = interpretGumroad(outcome.body, input.now);
  const nextCache: LicenseCache = {
    key,
    valid: interpreted.valid,
    reason: interpreted.reason,
    message: interpreted.message,
    checkedAt: input.now,
  };
  return {
    decision: { ...interpreted, source: "network", checkedAt: input.now },
    nextCache,
  };
}

/** Pro flag for the calendar UI. Reads the cache only, so opening the calendar never uses the network. */
export function proFromCacheOnly(cache: LicenseCache | null, key: string, now: number): boolean {
  if (!cache || cache.key !== key.trim() || !cache.valid) return false;
  return now - cache.checkedAt < OFFLINE_GRACE_MS;
}
