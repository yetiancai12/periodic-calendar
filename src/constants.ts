/** Replace with the Gumroad product id before selling Pro. */
export const GUMROAD_PRODUCT_ID = "PRODUCT_ID_PLACEHOLDER";

/** The only network endpoint this plugin calls. */
export const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

export const VIEW_TYPE = "kept-calendar";

export const BLOCK_START = "%% kept-calendar:generated:start %%";
export const BLOCK_END = "%% kept-calendar:generated:end %%";

/** Static sentence shown in the free weekly review and in plugin settings. */
export const PRO_UPGRADE_LINE =
  "Upgrade to Pro to include notes changed during this period and open tasks.";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;
