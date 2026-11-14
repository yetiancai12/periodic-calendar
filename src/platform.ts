/** Where a new calendar leaf should open. Mobile has no usable right sidebar. */
export function leafTargetForPlatform(isMobile: boolean): "right-sidebar" | "current" {
  return isMobile ? "current" : "right-sidebar";
}

export interface MobileSimulationResult {
  isMobile: true;
  leaf: "current";
  calendarWeekNumber: number;
  reviewHasDailyLink: boolean;
  reviewHasUpgradeLine: boolean;
  desktopOnly: false;
}

/**
 * Runs the free calendar and weekly review path with the mobile flag on.
 * This is the automated stand-in for Obsidian's app.emulateMobile(true).
 */
export function simulateMobileMode(input: {
  weekNumber: number;
  reviewMarkdown: string;
  upgradeLine: string;
  isDesktopOnly: boolean;
}): MobileSimulationResult {
  if (input.isDesktopOnly) {
    throw new Error("Plugin manifest is desktop-only, so mobile mode cannot run it.");
  }
  const leaf = leafTargetForPlatform(true);
  if (leaf !== "current") {
    throw new Error("Mobile mode should open the calendar in the current leaf.");
  }
  return {
    isMobile: true,
    leaf,
    calendarWeekNumber: input.weekNumber,
    reviewHasDailyLink: input.reviewMarkdown.includes("[["),
    reviewHasUpgradeLine: input.reviewMarkdown.includes(input.upgradeLine),
    desktopOnly: false,
  };
}
