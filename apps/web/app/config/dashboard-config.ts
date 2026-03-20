import type { AnimeItem } from "@repo/anime-core";

export type PanelKey =
  | "cloud"
  | "search"
  | "rank"
  | "tier"
  | "grid"
  | "history"
  | "editor";

export type TierLevelConfig = {
  tier: AnimeItem["tier"];
  label: string;
  color: string;
};

export type DashboardConfig = {
  appTitle: string;
  appDescription: string;
  sidebarTitle: string;
  sidebarHint: string;
  defaultPanels: PanelKey[];
  panelTitles: Record<PanelKey, string>;
  tierBoardName: string;
  gridBoardName: string;
  tierLevels: TierLevelConfig[];
};

export const DASHBOARD_CONFIG: DashboardConfig = {
  appTitle: "auto-memories-doll",
  appDescription:
    "个人动漫管理 + 计数器 + Rank + 九宫格，一套数据驱动全部视图。",
  sidebarTitle: "功能面板",
  sidebarHint: "默认展示搜索和排行，点击可切换其它模块。",
  defaultPanels: ["search", "rank"] as PanelKey[],
  panelTitles: {
    cloud: "云端同步",
    search: "Bangumi 搜索",
    rank: "Rank 排行（拖拽）",
    tier: "Tier Rank 图生成器",
    grid: "九宫格",
    history: "历史记录",
    editor: "文本配置",
  },
  tierBoardName: "AUTO TIER BOARD",
  gridBoardName: "九宫格拼图",
  tierLevels: [
    { tier: "S", label: "BEST", color: "#6be77a" },
    { tier: "A", label: "GREAT", color: "#f57878" },
    { tier: "B", label: "GOOD", color: "#f3be7d" },
    { tier: "C", label: "MAYBE", color: "#f5dd79" },
    { tier: "Unrated", label: "IDK", color: "#acef73" },
  ],
};
