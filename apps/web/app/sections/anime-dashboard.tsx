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

const fetcher = async (url: string): Promise<Anime[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("搜索失败");
  }

  return response.json() as Promise<Anime[]>;
};

const tierOptions = ["S", "A", "B", "C", "Unrated"] as const;

function SortableRankCard({
  anime,
  onRemove,
  onTierChange,
}: {
  anime: AnimeItem;
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
        {tierOptions.map((tier) => (
          <option key={tier} value={tier}>
            {tier}
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

export function AnimeDashboard() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );
  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const list = useAnimeStore((state) => state.list);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const removeAnime = useAnimeStore((state) => state.removeAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);

  const { data, isLoading } = useSWR(
    keyword ? `/api/anime?q=${encodeURIComponent(keyword)}` : null,
    fetcher,
  );

  const grouped = useMemo(() => {
    return {
      S: list.filter((item) => item.tier === "S").length,
      A: list.filter((item) => item.tier === "A").length,
      B: list.filter((item) => item.tier === "B").length,
      C: list.filter((item) => item.tier === "C").length,
      Unrated: list.filter((item) => item.tier === "Unrated").length,
    };
  }, [list]);

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

  return (
    <main className="dashboard">
      <header className="hero">
        <h1>auto-memories-doll</h1>
        <p>个人动漫管理 + 计数器 + Rank + 九宫格，一套数据驱动全部视图。</p>
      </header>

      <section className="panel stats">
        <div>
          <strong>{list.length}</strong>
          <span>总收藏</span>
        </div>
        <div>
          <strong>{grouped.S}</strong>
          <span>S 级</span>
        </div>
        <div>
          <strong>{grouped.A}</strong>
          <span>A 级</span>
        </div>
        <div>
          <strong>{grouped.B + grouped.C + grouped.Unrated}</strong>
          <span>其余</span>
        </div>
      </section>

      <section className="panel search-panel">
        <h2>Bangumi 搜索</h2>
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

      <section className="panel rank-panel">
        <div className="panel-head">
          <h2>Rank 排行（拖拽）</h2>
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
                  onRemove={removeAnime}
                  onTierChange={updateTier}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <section className="panel grid-panel">
        <div className="panel-head">
          <h2>九宫格</h2>
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
            <div ref={gridRef} className="grid-board">
              {gridCells.map((item, index) =>
                item ? (
                  <SortableGridCell key={item.id} anime={item} />
                ) : (
                  <div className="grid-cell placeholder" key={`empty-${index}`}>
                    空位
                  </div>
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </main>
  );
}
