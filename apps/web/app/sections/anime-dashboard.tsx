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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  compactGrid,
  toNineGrid,
  type Anime,
  type AnimeItem,
  useAnimeStore,
} from "@repo/anime-core";
import { toPng } from "html-to-image";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";

import {
  DASHBOARD_CONFIG,
  type DashboardConfig,
  type PanelKey,
  type TierLevelConfig,
} from "../config/dashboard-config";

const fetcher = async (url: string): Promise<Anime[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("搜索失败");
  }

  return response.json() as Promise<Anime[]>;
};

const createInitialConfig = (): DashboardConfig => ({
  ...DASHBOARD_CONFIG,
  panelTitles: { ...DASHBOARD_CONFIG.panelTitles },
  tierLevels: DASHBOARD_CONFIG.tierLevels.map((item) => ({ ...item })),
});

function SortableRankCard({
  anime,
  tierLevels,
  onRemove,
  onTierChange,
}: {
  anime: AnimeItem;
  tierLevels: DashboardConfig["tierLevels"];
  onRemove: (id: number) => void;
  onTierChange: (id: number, value: AnimeItem["tier"]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: anime.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rank-card"
      {...attributes}
      {...listeners}
    >
      <Image
        src={anime.cover}
        alt={anime.name}
        width={72}
        height={100}
        className="cover"
      />
      <div className="rank-content">
        <p className="title">{anime.name}</p>
        <p className="score">Bangumi {anime.score.toFixed(1)}</p>
      </div>
      <select
        className="tier-select"
        value={anime.tier}
        onChange={(event) =>
          onTierChange(anime.id, event.target.value as AnimeItem["tier"])
        }
        onPointerDown={(event) => event.stopPropagation()}
      >
        {tierLevels.map((tier) => (
          <option key={tier.tier} value={tier.tier}>
            {tier.label}
          </option>
        ))}
      </select>
      <button
        className="ghost danger"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(anime.id)}
      >
        删除
      </button>
    </div>
  );
}

function SortableGridCell({ anime }: { anime: AnimeItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: anime.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid-cell"
      {...attributes}
      {...listeners}
    >
      <Image
        src={anime.cover}
        alt={anime.name}
        width={180}
        height={240}
        className="grid-cover"
      />
      <span>{anime.name}</span>
    </div>
  );
}

function SortableTierLevelEditorRow({
  level,
  onTierKeyBlur,
  onLabelChange,
  onColorChange,
  onRemove,
}: {
  level: TierLevelConfig;
  onTierKeyBlur: (fromTier: string, nextTier: string) => void;
  onLabelChange: (tier: string, value: string) => void;
  onColorChange: (tier: string, value: string) => void;
  onRemove: (tier: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.tier });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-level-row ${isDragging ? "dragging" : ""}`}
    >
      <button
        className="drag-handle"
        aria-label={`拖拽排序 ${level.tier}`}
        {...attributes}
        {...listeners}
      >
        :::
      </button>
      <input
        defaultValue={level.tier}
        onBlur={(event) => onTierKeyBlur(level.tier, event.target.value)}
        placeholder="tier key"
      />
      <input
        value={level.label}
        onChange={(event) => onLabelChange(level.tier, event.target.value)}
        placeholder="显示名称"
      />
      <input
        value={level.color}
        onChange={(event) => onColorChange(level.tier, event.target.value)}
        placeholder="#hex 颜色"
      />
      <button className="ghost danger" onClick={() => onRemove(level.tier)}>
        删除
      </button>
    </div>
  );
}

export function AnimeDashboard() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );
  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [historyOrder, setHistoryOrder] = useState<"desc" | "asc">("desc");
  const [newTierKey, setNewTierKey] = useState("");
  const [newTierLabel, setNewTierLabel] = useState("");
  const [newTierColor, setNewTierColor] = useState("#9cc5ff");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingTier, setIsExportingTier] = useState(false);
  const [uiConfig, setUiConfig] =
    useState<DashboardConfig>(createInitialConfig);
  const [activePanels, setActivePanels] = useState<PanelKey[]>(
    DASHBOARD_CONFIG.defaultPanels,
  );
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tierRef = useRef<HTMLDivElement | null>(null);

  const list = useAnimeStore((state) => state.list);
  const history = useAnimeStore((state) => state.history);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const removeAnime = useAnimeStore((state) => state.removeAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);
  const remapTier = useAnimeStore((state) => state.remapTier);

  const { data, isLoading } = useSWR(
    keyword ? `/api/anime?q=${encodeURIComponent(keyword)}` : null,
    fetcher,
  );

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

  const statPrimaryLevels = uiConfig.tierLevels.slice(0, 3);
  const statKnownCount = statPrimaryLevels.reduce(
    (sum, level) => sum + (tierCountMap[level.tier] || 0),
    0,
  );
  const statOtherCount = Math.max(0, list.length - statKnownCount);

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
    { key: "search", label: uiConfig.panelTitles.search },
    { key: "rank", label: uiConfig.panelTitles.rank },
    { key: "tier", label: uiConfig.panelTitles.tier },
    { key: "grid", label: uiConfig.panelTitles.grid },
    { key: "history", label: uiConfig.panelTitles.history },
    { key: "editor", label: uiConfig.panelTitles.editor },
  ];

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

        <section className="panel stats">
          <div>
            <strong>{list.length}</strong>
            <span>总收藏</span>
          </div>
          {statPrimaryLevels.map((level) => (
            <div key={level.tier}>
              <strong>{tierCountMap[level.tier] || 0}</strong>
              <span>{level.label}</span>
            </div>
          ))}
          <div>
            <strong>{statOtherCount}</strong>
            <span>其他层级</span>
          </div>
        </section>

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
                  <button className="primary" onClick={() => addAnime(anime)}>
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
          <section className="panel history-panel">
            <div className="panel-head">
              <h2>{uiConfig.panelTitles.history}</h2>
              <div className="history-actions">
                <span>按时间</span>
                <select
                  value={historyOrder}
                  onChange={(event) =>
                    setHistoryOrder(event.target.value as "desc" | "asc")
                  }
                >
                  <option value="desc">最新在前</option>
                  <option value="asc">最早在前</option>
                </select>
              </div>
            </div>
            <div className="history-list">
              {sortedHistory.length === 0 ? <p>还没有添加记录</p> : null}
              {sortedHistory.map((record, index) => (
                <article
                  className="history-item"
                  key={`${record.animeId}-${record.addedAt}-${index}`}
                >
                  <Image
                    src={record.cover}
                    alt={record.name}
                    width={52}
                    height={52}
                    className="history-cover"
                  />
                  <div>
                    <p className="title">{record.name}</p>
                    <p className="history-time">
                      添加时间{" "}
                      {new Date(record.addedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
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
