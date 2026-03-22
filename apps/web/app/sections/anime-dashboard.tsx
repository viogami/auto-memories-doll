"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  compactGrid,
  toNineGrid,
  type Anime,
  type AnimeItem,
  useAnimeStore,
} from "@repo/anime-core";
import { toPng } from "html-to-image";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import {
  DASHBOARD_CONFIG,
  type DashboardConfig,
  type PanelKey,
} from "../config/dashboard-config";
import {
  SortableGridCell,
  SortableRankCard,
  SortableTierLevelEditorRow,
} from "./dashboard/sortable-cards";
import {
  createInitialConfig,
  normalizeConfig,
  parseCloudPayload,
} from "./dashboard/dashboard-helpers";
import { CloudPanel } from "./dashboard/cloud-panel";
import { HistoryPanel } from "./dashboard/history-panel";
import { StatsPanel } from "./dashboard/stats-panel";

const TOKEN_KEY =
  process.env.NEXT_PUBLIC_CLOUD_TOKEN_KEY?.trim() || "am_cloud_token";
const USERNAME_KEY =
  process.env.NEXT_PUBLIC_CLOUD_USER_KEY?.trim() || "am_cloud_username";
const REQUEST_TIMEOUT_MS = 7000;
const HEALTH_CHECK_INTERVAL_MS = 20000;

const fetcher = async (url: string): Promise<Anime[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("搜索失败");
  }

  return response.json() as Promise<Anime[]>;
};

export function AnimeDashboard() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [historyOrder, setHistoryOrder] = useState<"desc" | "asc">("desc");
  const [showRemovedHistory, setShowRemovedHistory] = useState(false);
  const [historyNameFilter, setHistoryNameFilter] = useState("");

  const [uiConfig, setUiConfig] =
    useState<DashboardConfig>(createInitialConfig);
  const [activePanels, setActivePanels] = useState<PanelKey[]>(
    DASHBOARD_CONFIG.defaultPanels,
  );

  const [newTierKey, setNewTierKey] = useState("");
  const [newTierLabel, setNewTierLabel] = useState("");
  const [newTierColor, setNewTierColor] = useState("#9cc5ff");

  const [token, setToken] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncControlEnabled, setSyncControlEnabled] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingTier, setIsExportingTier] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const tierRef = useRef<HTMLDivElement | null>(null);
  const autoPulledTokenRef = useRef("");

  const list = useAnimeStore((state) => state.list);
  const history = useAnimeStore((state) => state.history);
  const removedHistory = useAnimeStore((state) => state.removedHistory);
  const setList = useAnimeStore((state) => state.setList);
  const setHistory = useAnimeStore((state) => state.setHistory);
  const setRemovedHistory = useAnimeStore((state) => state.setRemovedHistory);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const removeAnime = useAnimeStore((state) => state.removeAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);
  const remapTier = useAnimeStore((state) => state.remapTier);

  const apiBase = (
    process.env.NEXT_PUBLIC_CLOUD_API_BASE?.trim() || "http://localhost:8080/CH"
  ).replace(/\/+$/, "");

  const { data, isLoading } = useSWR(
    keyword ? `/api/anime?q=${encodeURIComponent(keyword)}` : null,
    fetcher,
  );

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY) || "";
    const savedUser = window.localStorage.getItem(USERNAME_KEY) || "";

    if (savedToken) {
      setToken(savedToken);
    }
    if (savedUser) {
      setCurrentUser(savedUser);
      setAuthUsername(savedUser);
    }
  }, []);

  const filteredSearch = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!searchText.trim()) {
      return data;
    }

    return data.filter((item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [data, searchText]);

  const tierCountMap = useMemo(() => {
    const base: Record<string, number> = {};

    for (const level of uiConfig.tierLevels) {
      base[level.tier] = 0;
    }

    for (const item of list) {
      base[item.tier] = (base[item.tier] || 0) + 1;
    }

    return base;
  }, [list, uiConfig.tierLevels]);

  const statUnknownCount = useMemo(() => {
    const knownTiers = new Set(uiConfig.tierLevels.map((level) => level.tier));

    return list.filter((item) => !knownTiers.has(item.tier)).length;
  }, [list, uiConfig.tierLevels]);

  const gridCells = compactGrid(toNineGrid(list));
  const gridItems = gridCells.filter(
    (item): item is AnimeItem => item !== null,
  );

  const sortedHistory = useMemo(() => {
    const next = [...history].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
    );

    return historyOrder === "asc" ? next : next.reverse();
  }, [history, historyOrder]);

  const sortedRemovedHistory = useMemo(() => {
    const next = [...removedHistory].sort(
      (a, b) =>
        new Date(a.removedAt).getTime() - new Date(b.removedAt).getTime(),
    );

    return historyOrder === "asc" ? next : next.reverse();
  }, [historyOrder, removedHistory]);

  const filteredHistory = useMemo(() => {
    const trimmedName = historyNameFilter.trim().toLowerCase();

    return sortedHistory.filter((record) => {
      if (trimmedName && !record.name.toLowerCase().includes(trimmedName)) {
        return false;
      }

      return true;
    });
  }, [historyNameFilter, sortedHistory]);

  const filteredRemovedHistory = useMemo(() => {
    const trimmedName = historyNameFilter.trim().toLowerCase();

    return sortedRemovedHistory.filter((record) => {
      if (trimmedName && !record.name.toLowerCase().includes(trimmedName)) {
        return false;
      }

      return true;
    });
  }, [historyNameFilter, sortedRemovedHistory]);

  const tierGroups = useMemo(() => {
    const knownRows = uiConfig.tierLevels.map((row) => ({
      ...row,
      items: list.filter((item) => item.tier === row.tier),
    }));

    const knownSet = new Set(uiConfig.tierLevels.map((item) => item.tier));
    const unknownItems = list.filter((item) => !knownSet.has(item.tier));

    if (unknownItems.length > 0) {
      knownRows.push({
        tier: "__other__",
        label: "OTHER",
        color: "#b4bfd1",
        items: unknownItems,
      });
    }

    return knownRows;
  }, [list, uiConfig.tierLevels]);

  const panelItems: Array<{ key: PanelKey; label: string }> = [
    { key: "cloud", label: uiConfig.panelTitles.cloud },
    { key: "search", label: uiConfig.panelTitles.search },
    { key: "rank", label: uiConfig.panelTitles.rank },
    { key: "tier", label: uiConfig.panelTitles.tier },
    { key: "grid", label: uiConfig.panelTitles.grid },
    { key: "history", label: uiConfig.panelTitles.history },
    { key: "editor", label: uiConfig.panelTitles.editor },
  ];

  const cloudSnapshot = useMemo(
    () =>
      JSON.stringify({
        history: history.map((item) => ({
          anime_id: item.animeId,
          name: item.name,
          cover: item.cover,
          added_at: item.addedAt,
        })),
        rank: {
          title: "前端自动同步快照",
          tier_board_name: uiConfig.tierBoardName,
          grid_board_name: uiConfig.gridBoardName,
          payload: {
            list,
            uiConfig,
          },
        },
      }),
    [history, list, uiConfig],
  );

  const switchToOffline = useCallback((message?: string) => {
    setBackendStatus("offline");
    setToken("");
    setCurrentUser("");
    window.localStorage.removeItem(TOKEN_KEY);
    setCloudMessage(message || "后端连接中断，请稍后重试");
  }, []);

  const requestWithTimeout = useCallback(
    async (path: string, init?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      try {
        const response = await fetch(`${apiBase}${path}`, {
          ...init,
          signal: controller.signal,
        });

        setBackendStatus("online");
        return response;
      } catch {
        switchToOffline("后端连接失败，请先检查服务是否启动");
        throw new Error("后端连接失败");
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [apiBase, switchToOffline],
  );

  const checkBackendStatus = useCallback(async () => {
    try {
      const response = await requestWithTimeout("/healthz", {
        method: "GET",
      });

      if (response.ok) {
        setBackendStatus("online");
      } else {
        switchToOffline("后端服务响应异常，请检查服务状态");
      }
    } catch {
      // offline state is already handled inside requestWithTimeout
    }
  }, [requestWithTimeout, switchToOffline]);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) {
        throw new Error("请先登录");
      }

      const response = await requestWithTimeout(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });

      return response;
    },
    [requestWithTimeout, token],
  );

  const loadCloudData = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingCloud(true);
    setCloudMessage("正在拉取云端数据...");

    try {
      const meRes = await authedFetch("/api/v1/me");
      if (!meRes.ok) {
        throw new Error("会话失效，请重新登录");
      }
      const me = (await meRes.json()) as { username?: string };
      const username = me.username || "";
      setCurrentUser(username);
      if (username) {
        window.localStorage.setItem(USERNAME_KEY, username);
      }

      const historyRes = await authedFetch("/api/v1/history?limit=200");
      if (historyRes.ok) {
        const historyJson = (await historyRes.json()) as {
          items?: Array<{
            anime_id: number;
            name: string;
            cover: string;
            added_at?: string;
            created_at?: string;
          }>;
          removed_items?: Array<{
            anime_id: number;
            name: string;
            cover: string;
            removed_at?: string;
            added_at?: string;
          }>;
        };
        const cloudHistory = (historyJson.items || []).map((item) => ({
          animeId: item.anime_id,
          name: item.name,
          cover: item.cover,
          addedAt: item.added_at || item.created_at || new Date().toISOString(),
        }));
        const cloudRemovedHistory = (historyJson.removed_items || []).map(
          (item) => ({
            animeId: item.anime_id,
            name: item.name,
            cover: item.cover,
            removedAt:
              item.removed_at || item.added_at || new Date().toISOString(),
            addedAt: item.added_at,
          }),
        );
        setHistory(cloudHistory);
        setRemovedHistory(cloudRemovedHistory);
      }

      const rankRes = await authedFetch("/api/v1/rank/latest");
      if (rankRes.ok) {
        const rankJson = (await rankRes.json()) as {
          item?: { payload?: unknown } | null;
        };
        const parsed = parseCloudPayload(rankJson.item?.payload);
        if (Array.isArray(parsed.list) && parsed.list.length > 0) {
          setList(parsed.list);
        }
        if (parsed.uiConfig) {
          setUiConfig((state) => normalizeConfig(parsed.uiConfig, state));
        }
      }

      setCloudMessage("云端数据同步完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载失败";
      setCloudMessage(message);
      if (message.includes("会话失效")) {
        setToken("");
        setCurrentUser("");
        window.localStorage.removeItem(TOKEN_KEY);
      }
      setBackendStatus("online");
    } finally {
      setLoadingCloud(false);
    }
  }, [authedFetch, setHistory, setList, setRemovedHistory, token]);

  useEffect(() => {
    void checkBackendStatus();
    const timer = window.setInterval(() => {
      void checkBackendStatus();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [checkBackendStatus]);

  useEffect(() => {
    if (!token) {
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      autoPulledTokenRef.current = "";
      return;
    }

    if (syncControlEnabled) {
      return;
    }

    if (autoPulledTokenRef.current === token) {
      return;
    }

    autoPulledTokenRef.current = token;
    void loadCloudData();
  }, [loadCloudData, syncControlEnabled, token]);

  const submitAuth = async (mode: "login" | "register") => {
    const username = authUsername.trim();
    const password = authPassword;

    if (!username || !password) {
      setCloudMessage("请输入用户名和密码");
      return;
    }

    setLoadingCloud(true);
    setCloudMessage(mode === "login" ? "登录中..." : "注册中...");

    try {
      const response = await requestWithTimeout(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const json = (await response.json()) as {
        token?: string;
        username?: string;
        error?: string;
      };

      if (!response.ok || !json.token) {
        throw new Error(json.error || "认证失败");
      }

      setToken(json.token);
      setCurrentUser(json.username || username);
      window.localStorage.setItem(USERNAME_KEY, json.username || username);
      setCloudMessage(mode === "login" ? "登录成功" : "注册并登录成功");
      setBackendStatus("online");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "认证失败");
    } finally {
      setLoadingCloud(false);
    }
  };

  const logout = () => {
    setToken("");
    setCurrentUser("");
    setCloudMessage("已退出登录");
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USERNAME_KEY);
  };

  const syncToCloud = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) {
        if (!options?.silent) {
          setCloudMessage("请先登录");
        }
        return;
      }

      setSyncingCloud(true);
      if (!options?.silent) {
        setCloudMessage("正在上传到云端...");
      }

      try {
        const response = await authedFetch("/api/v1/sync", {
          method: "POST",
          body: cloudSnapshot,
        });

        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error || "同步失败");
        }

        if (!options?.silent) {
          setCloudMessage("上传成功，云端已保存当前本地数据");
        }
      } catch (error) {
        setCloudMessage(error instanceof Error ? error.message : "同步失败");
      } finally {
        setSyncingCloud(false);
      }
    },
    [authedFetch, cloudSnapshot, token],
  );

  const confirmPullFromCloud = () => {
    if (!syncControlEnabled) {
      setCloudMessage("请先开启同步控制，再选择同步方向");
      return;
    }

    const confirmed = window.confirm(
      "拉取云端将覆盖当前本地列表与历史记录，是否继续？",
    );
    if (!confirmed) {
      setCloudMessage("已取消拉取操作");
      return;
    }

    void loadCloudData();
  };

  const confirmPushToCloud = () => {
    if (!syncControlEnabled) {
      setCloudMessage("请先开启同步控制，再选择同步方向");
      return;
    }

    const confirmed = window.confirm(
      "上传本地将以当前本地数据生成云端新快照，是否继续？",
    );
    if (!confirmed) {
      setCloudMessage("已取消上传操作");
      return;
    }

    void syncToCloud();
  };

  const updateTierLevel = (
    tier: AnimeItem["tier"],
    field: "tier" | "label" | "color",
    value: string,
  ) => {
    if (field === "tier") {
      const nextKey = value.trim();

      if (!nextKey || nextKey === tier) {
        return;
      }

      const duplicated = uiConfig.tierLevels.some(
        (item) => item.tier === nextKey,
      );

      if (duplicated) {
        return;
      }

      remapTier(tier, nextKey);
    }

    setUiConfig((state) => ({
      ...state,
      tierLevels: state.tierLevels.map((item) =>
        item.tier === tier
          ? {
              ...item,
              [field]: field === "tier" ? value.trim() : value,
            }
          : item,
      ),
    }));
  };

  const addTierLevel = () => {
    const tier = newTierKey.trim();
    const label = newTierLabel.trim() || tier;

    if (!tier) {
      return;
    }

    const existed = uiConfig.tierLevels.some((item) => item.tier === tier);

    if (existed) {
      return;
    }

    setUiConfig((state) => ({
      ...state,
      tierLevels: [
        ...state.tierLevels,
        {
          tier,
          label,
          color: newTierColor.trim() || "#9cc5ff",
        },
      ],
    }));

    setNewTierKey("");
    setNewTierLabel("");
  };

  const removeTierLevel = (tier: string) => {
    if (uiConfig.tierLevels.length <= 1) {
      return;
    }

    const fallback = uiConfig.tierLevels.find((item) => item.tier !== tier);

    if (!fallback) {
      return;
    }

    remapTier(tier, fallback.tier);
    setUiConfig((state) => ({
      ...state,
      tierLevels: state.tierLevels.filter((item) => item.tier !== tier),
    }));
  };

  const onRankDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = list.findIndex((item) => item.id === active.id);
    const newIndex = list.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    reorder(arrayMove(list, oldIndex, newIndex));
  };

  const onGridDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = list.findIndex((item) => item.id === active.id);
    const newIndex = list.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    reorder(arrayMove(list, oldIndex, newIndex));
  };

  const onTierOrderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = uiConfig.tierLevels.findIndex(
      (item) => item.tier === active.id,
    );
    const newIndex = uiConfig.tierLevels.findIndex(
      (item) => item.tier === over.id,
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setUiConfig((state) => ({
      ...state,
      tierLevels: arrayMove(state.tierLevels, oldIndex, newIndex),
    }));
  };

  const togglePanel = (key: PanelKey) => {
    setActivePanels((state) => {
      if (state.includes(key)) {
        return state.filter((item) => item !== key);
      }

      return [...state, key];
    });
  };

  const exportGrid = async () => {
    if (!gridRef.current) {
      return;
    }

    setIsExporting(true);

    try {
      const png = await toPng(gridRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const anchor = document.createElement("a");
      anchor.download = `anime-grid-${Date.now()}.png`;
      anchor.href = png;
      anchor.click();
    } finally {
      setIsExporting(false);
    }
  };

  const exportTierBoard = async () => {
    if (!tierRef.current) {
      return;
    }

    setIsExportingTier(true);

    try {
      const png = await toPng(tierRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const anchor = document.createElement("a");
      anchor.download = `anime-tier-board-${Date.now()}.png`;
      anchor.href = png;
      anchor.click();
    } finally {
      setIsExportingTier(false);
    }
  };

  const isVisible = (key: PanelKey) => activePanels.includes(key);

  return (
    <div className="dashboard-shell">
      <aside className="sidebar panel">
        <h2>{uiConfig.sidebarTitle}</h2>
        <p className="sidebar-hint">{uiConfig.sidebarHint}</p>
        <div className="sidebar-nav">
          {panelItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-btn ${isVisible(item.key) ? "active" : ""}`}
              onClick={() => togglePanel(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="hero">
          <h1>{uiConfig.appTitle}</h1>
          <p>{uiConfig.appDescription}</p>
        </header>

        {isVisible("cloud") ? (
          <CloudPanel
            panelTitle={uiConfig.panelTitles.cloud}
            backendStatus={backendStatus}
            token={token}
            currentUser={currentUser}
            authUsername={authUsername}
            authPassword={authPassword}
            loadingCloud={loadingCloud}
            syncingCloud={syncingCloud}
            syncControlEnabled={syncControlEnabled}
            cloudMessage={cloudMessage}
            onCheckBackendStatus={() => {
              void checkBackendStatus();
            }}
            onLogout={logout}
            onAuthUsernameChange={setAuthUsername}
            onAuthPasswordChange={setAuthPassword}
            onSubmitAuth={(mode) => {
              void submitAuth(mode);
            }}
            onSyncControlEnabledChange={setSyncControlEnabled}
            onConfirmPullFromCloud={confirmPullFromCloud}
            onConfirmPushToCloud={confirmPushToCloud}
          />
        ) : null}

        <StatsPanel
          listCount={list.length}
          tierLevels={uiConfig.tierLevels}
          tierCountMap={tierCountMap}
          statUnknownCount={statUnknownCount}
        />

        {isVisible("search") ? (
          <section className="panel search-panel">
            <h2>{uiConfig.panelTitles.search}</h2>
            <div className="row">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="输入动漫名，自动搜索"
              />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="二次过滤结果"
              />
            </div>
            <div className="search-list">
              {isLoading ? <p>搜索中...</p> : null}
              {filteredSearch.map((anime) => (
                <article className="search-item" key={anime.id}>
                  <Image
                    src={anime.cover}
                    alt={anime.name}
                    width={72}
                    height={100}
                    className="cover"
                  />
                  <div>
                    <p className="title">{anime.name}</p>
                    <p className="score">Bangumi {anime.score.toFixed(1)}</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      addAnime(
                        anime,
                        uiConfig.tierLevels.map((level) => level.tier),
                      )
                    }
                  >
                    加入收藏
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {isVisible("rank") ? (
          <section className="panel rank-panel">
            <div className="panel-head">
              <h2>{uiConfig.panelTitles.rank}</h2>
              <p>拖动条目调整顺序，右侧可改 Tier。</p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onRankDragEnd}
            >
              <SortableContext
                items={list.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="rank-list">
                  {list.map((anime) => (
                    <SortableRankCard
                      key={anime.id}
                      anime={anime}
                      tierLevels={uiConfig.tierLevels}
                      onRemove={removeAnime}
                      onTierChange={updateTier}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        ) : null}

        {isVisible("tier") ? (
          <section className="panel tier-panel">
            <div className="panel-head">
              <h2>{uiConfig.panelTitles.tier}</h2>
              <button
                className="primary"
                onClick={exportTierBoard}
                disabled={isExportingTier || list.length === 0}
              >
                {isExportingTier ? "导出中..." : "导出 Tier 图"}
              </button>
            </div>

            <div ref={tierRef} className="tier-board">
              <div className="tier-brand">{uiConfig.tierBoardName}</div>
              {tierGroups.map((group) => (
                <div className="tier-row" key={group.tier}>
                  <div
                    className="tier-label"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.label}
                  </div>
                  <div className="tier-items">
                    {group.items.length === 0 ? (
                      <span className="tier-empty">暂无条目</span>
                    ) : (
                      group.items.map((item) => (
                        <div
                          className="tier-avatar-wrap"
                          key={`tier-${item.id}`}
                        >
                          <Image
                            src={item.cover}
                            alt={item.name}
                            width={84}
                            height={84}
                            className="tier-avatar"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isVisible("grid") ? (
          <section className="panel grid-panel">
            <div className="panel-head">
              <h2>{uiConfig.panelTitles.grid}</h2>
              <button
                className="primary"
                onClick={exportGrid}
                disabled={isExporting || gridItems.length === 0}
              >
                {isExporting ? "导出中..." : "导出 PNG"}
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onGridDragEnd}
            >
              <SortableContext
                items={gridItems.map((item) => item.id)}
                strategy={rectSortingStrategy}
              >
                <div ref={gridRef} className="grid-export-sheet">
                  <div className="grid-export-title">
                    {uiConfig.gridBoardName}
                  </div>
                  <div className="grid-board">
                    {gridCells.map((item, index) =>
                      item ? (
                        <SortableGridCell key={item.id} anime={item} />
                      ) : (
                        <div
                          className="grid-cell placeholder"
                          key={`empty-${index}`}
                        >
                          空位
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </SortableContext>
            </DndContext>
          </section>
        ) : null}

        {isVisible("history") ? (
          <HistoryPanel
            panelTitle={uiConfig.panelTitles.history}
            showRemovedHistory={showRemovedHistory}
            historyNameFilter={historyNameFilter}
            historyOrder={historyOrder}
            filteredHistory={filteredHistory}
            filteredRemovedHistory={filteredRemovedHistory}
            onToggleShowRemovedHistory={() =>
              setShowRemovedHistory((value) => !value)
            }
            onHistoryNameFilterChange={setHistoryNameFilter}
            onHistoryOrderChange={setHistoryOrder}
          />
        ) : null}

        {isVisible("editor") ? (
          <section className="panel editor-panel">
            <h2>{uiConfig.panelTitles.editor}</h2>
            <p className="sidebar-hint">修改后实时生效，可直接导出图。</p>

            <div className="editor-grid">
              <label className="editor-field">
                <span>Tier 图标题（tierBoardName）</span>
                <input
                  value={uiConfig.tierBoardName}
                  onChange={(event) =>
                    setUiConfig((state) => ({
                      ...state,
                      tierBoardName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="editor-field">
                <span>九宫格导出标题（gridBoardName）</span>
                <input
                  value={uiConfig.gridBoardName}
                  onChange={(event) =>
                    setUiConfig((state) => ({
                      ...state,
                      gridBoardName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="editor-levels">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onTierOrderDragEnd}
              >
                <SortableContext
                  items={uiConfig.tierLevels.map((item) => item.tier)}
                  strategy={verticalListSortingStrategy}
                >
                  {uiConfig.tierLevels.map((level) => (
                    <SortableTierLevelEditorRow
                      key={level.tier}
                      level={level}
                      onTierKeyBlur={(fromTier, nextTier) =>
                        updateTierLevel(fromTier, "tier", nextTier)
                      }
                      onLabelChange={(tier, value) =>
                        updateTierLevel(tier, "label", value)
                      }
                      onColorChange={(tier, value) =>
                        updateTierLevel(tier, "color", value)
                      }
                      onRemove={removeTierLevel}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <div className="editor-add-row">
                <input
                  value={newTierKey}
                  onChange={(event) => setNewTierKey(event.target.value)}
                  placeholder="新增 tier key，如 SSS"
                />
                <input
                  value={newTierLabel}
                  onChange={(event) => setNewTierLabel(event.target.value)}
                  placeholder="新增显示名，如 GOD"
                />
                <input
                  value={newTierColor}
                  onChange={(event) => setNewTierColor(event.target.value)}
                  placeholder="#hex 颜色"
                />
                <button className="primary" onClick={addTierLevel}>
                  添加 tier
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
