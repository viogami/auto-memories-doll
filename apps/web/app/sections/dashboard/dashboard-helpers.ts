import type { AnimeItem } from "@repo/anime-core";

import {
  DASHBOARD_CONFIG,
  type DashboardConfig,
  type TierLevelConfig,
} from "../../config/dashboard-config";

export const createInitialConfig = (): DashboardConfig => ({
  ...DASHBOARD_CONFIG,
  panelTitles: { ...DASHBOARD_CONFIG.panelTitles },
  tierLevels: DASHBOARD_CONFIG.tierLevels.map((item) => ({ ...item })),
});

export function normalizeConfig(
  input: unknown,
  fallback: DashboardConfig,
): DashboardConfig {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const source = input as Partial<DashboardConfig>;
  const levels = Array.isArray(source.tierLevels)
    ? source.tierLevels
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const row = item as Partial<TierLevelConfig>;
          const tier = typeof row.tier === "string" ? row.tier.trim() : "";
          if (!tier) {
            return null;
          }

          return {
            tier,
            label:
              typeof row.label === "string" && row.label.trim()
                ? row.label
                : tier,
            color:
              typeof row.color === "string" && row.color.trim()
                ? row.color
                : "#9cc5ff",
          };
        })
        .filter((item): item is TierLevelConfig => item !== null)
    : fallback.tierLevels;

  return {
    ...fallback,
    ...source,
    panelTitles: {
      ...fallback.panelTitles,
      ...(source.panelTitles || {}),
    },
    defaultPanels:
      Array.isArray(source.defaultPanels) && source.defaultPanels.length > 0
        ? source.defaultPanels
        : fallback.defaultPanels,
    tierLevels: levels.length > 0 ? levels : fallback.tierLevels,
  };
}

export function parseCloudPayload(payload: unknown): {
  list?: AnimeItem[];
  uiConfig?: DashboardConfig;
} {
  let raw = payload;

  if (typeof payload === "string") {
    try {
      raw = JSON.parse(payload);
    } catch {
      return {};
    }
  }

  if (!raw || typeof raw !== "object") {
    return {};
  }

  return raw as {
    list?: AnimeItem[];
    uiConfig?: DashboardConfig;
  };
}
