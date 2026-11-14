import { describe, expect, it } from "vitest";
import { GUMROAD_VERIFY_URL } from "../src/constants";
import {
  finishLicenseFetch,
  interpretGumroad,
  planLicenseFetch,
  proFromCacheOnly,
  type LicenseDecision,
} from "../src/license";
import type { LicenseCache } from "../src/settings";

const NOW = Date.UTC(2026, 10, 14);
const DAY = 24 * 60 * 60 * 1000;

function sale(overrides: Record<string, unknown> = {}): unknown {
  return {
    success: true,
    purchase: {
      refunded: false,
      chargebacked: false,
      disputed: false,
      dispute_won: false,
      subscription_cancelled_at: null,
      subscription_ended_at: null,
      subscription_failed_at: null,
      ...overrides,
    },
  };
}

function expectInvalid(body: unknown, reason: LicenseDecision["reason"], snippet: string): void {
  const result = interpretGumroad(body, NOW);
  expect(result.valid).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.message.toLowerCase()).toContain(snippet);
  expect(result.message).toContain("The calendar still works.");
}

describe("Gumroad license state", () => {
  it("accepts an active subscription and a fixed term that has not ended", () => {
    expect(interpretGumroad(sale(), NOW)).toMatchObject({ valid: true, reason: "active" });
    const future = new Date(NOW + 30 * DAY).toISOString();
    expect(interpretGumroad(sale({ subscription_ended_at: future }), NOW).valid).toBe(true);
    expect(interpretGumroad(sale({ disputed: true, dispute_won: true }), NOW).valid).toBe(true);
  });

  it("rejects invalid, refunded, chargebacked, cancelled, and ended purchases", () => {
    expectInvalid({ success: false, message: "missing" }, "invalid", "not valid");
    expectInvalid(sale({ refunded: true }), "refunded", "refunded");
    expectInvalid(sale({ chargebacked: true }), "chargebacked", "chargebacked");
    expectInvalid(sale({ disputed: true, dispute_won: false }), "chargebacked", "disputed");
    expectInvalid(sale({ subscription_cancelled_at: new Date(NOW + DAY).toISOString() }), "cancelled", "cancelled");
    expectInvalid(sale({ subscription_ended_at: new Date(NOW - DAY).toISOString() }), "ended", "ended");
    expectInvalid(sale({ subscription_failed_at: new Date(NOW - DAY).toISOString() }), "inactive", "not active");
    expectInvalid({ success: true }, "invalid", "not valid");
  });

  it("uses a 7-day cache and does not send the key again", () => {
    const cache: LicenseCache = {
      key: "KEY",
      valid: true,
      reason: "active",
      message: "License active. Pro reviews are unlocked.",
      checkedAt: NOW - 6 * DAY,
    };
    const fresh = planLicenseFetch({ now: NOW, key: "KEY", cache, force: false, productId: "prod_123" });
    expect(fresh.kind).toBe("decision");
    if (fresh.kind === "decision") expect(fresh.decision.source).toBe("cache");

    const stale = planLicenseFetch({
      now: NOW,
      key: "KEY",
      cache: { ...cache, checkedAt: NOW - 8 * DAY },
      force: false,
      productId: "prod_123",
    });
    expect(stale.kind).toBe("fetch");

    const forced = planLicenseFetch({ now: NOW, key: "KEY", cache, force: true, productId: "prod_123" });
    expect(forced.kind).toBe("fetch");
    if (forced.kind === "fetch") {
      expect(forced.request.url).toBe(GUMROAD_VERIFY_URL);
      expect(forced.request.method).toBe("POST");
      const params = new URLSearchParams(forced.request.body);
      expect(params.get("product_id")).toBe("prod_123");
      expect(params.get("license_key")).toBe("KEY");
      expect(params.get("increment_uses_count")).toBe("false");
      expect(forced.request.body).not.toContain("# heading");
    }
  });

  it("keeps a valid license for 14 offline days and refuses after that", () => {
    const cache: LicenseCache = {
      key: "KEY",
      valid: true,
      reason: "active",
      message: "License active. Pro reviews are unlocked.",
      checkedAt: NOW - 13 * DAY,
    };
    const grace = finishLicenseFetch({ now: NOW, key: "KEY", cache }, { ok: false });
    expect(grace.decision.valid).toBe(true);
    expect(grace.decision.source).toBe("offline-grace");
    expect(grace.nextCache).toBe(cache);
    expect(proFromCacheOnly(cache, "KEY", NOW)).toBe(true);

    const expired = finishLicenseFetch(
      { now: NOW, key: "KEY", cache: { ...cache, checkedAt: NOW - 15 * DAY } },
      { ok: false },
    );
    expect(expired.decision.valid).toBe(false);
    expect(expired.decision.reason).toBe("offline");
    expect(expired.decision.message).toContain("The calendar still works.");
    expect(expired.nextCache?.checkedAt).toBe(NOW - 15 * DAY);
  });

  it("does not grant offline grace to a refunded cache", () => {
    const cache: LicenseCache = {
      key: "KEY",
      valid: false,
      reason: "refunded",
      message: "This license was refunded. Pro is unavailable. The calendar still works.",
      checkedAt: NOW - 2 * DAY,
    };
    const cached = planLicenseFetch({ now: NOW, key: "KEY", cache, force: false, productId: "prod_123" });
    expect(cached.kind).toBe("decision");
    if (cached.kind === "decision") {
      expect(cached.decision.valid).toBe(false);
      expect(cached.decision.reason).toBe("refunded");
    }
    const offline = finishLicenseFetch({ now: NOW, key: "KEY", cache }, { ok: false });
    expect(offline.decision.valid).toBe(false);
    expect(offline.decision.reason).toBe("refunded");
  });

  it("stores a network result and clears the cache when the key is removed", () => {
    const applied = finishLicenseFetch({ now: NOW, key: "KEY", cache: null }, { ok: true, body: sale({ refunded: true }) });
    expect(applied.decision.reason).toBe("refunded");
    expect(applied.nextCache).toMatchObject({ key: "KEY", valid: false, reason: "refunded", checkedAt: NOW });

    const missing = planLicenseFetch({ now: NOW, key: "  ", cache: applied.nextCache, force: false, productId: "prod_123" });
    expect(missing.kind).toBe("decision");
    if (missing.kind === "decision") {
      expect(missing.decision.reason).toBe("missing");
      expect(missing.nextCache).toBeNull();
    }
  });

  it("does not call Gumroad while the product id is still a placeholder", () => {
    const plan = planLicenseFetch({ now: NOW, key: "KEY", cache: null, force: true });
    expect(plan.kind).toBe("decision");
    if (plan.kind === "decision") {
      expect(plan.decision.reason).toBe("unconfigured");
      expect(plan.decision.valid).toBe(false);
      expect(plan.decision.message).toContain("The calendar still works.");
    }
  });
});
