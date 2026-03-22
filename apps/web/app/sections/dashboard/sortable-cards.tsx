import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnimeItem } from "@repo/anime-core";
import Image from "next/image";

import type {
  DashboardConfig,
  TierLevelConfig,
} from "../../config/dashboard-config";

export function SortableRankCard({
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

export function SortableGridCell({ anime }: { anime: AnimeItem }) {
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

export function SortableTierLevelEditorRow({
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
