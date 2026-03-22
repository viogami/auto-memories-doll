import type { HistoryRecord } from "@repo/anime-core";
import Image from "next/image";

type HistoryPanelProps = {
  panelTitle: string;
  showRemovedHistory: boolean;
  historyTierFilter: string;
  historyTierOptions: string[];
  historyNameFilter: string;
  historyOrder: "desc" | "asc";
  filteredHistory: HistoryRecord[];
  currentTierByAnimeId: Map<number, string>;
  tierLabelMap: Map<string, string>;
  onToggleShowRemovedHistory: () => void;
  onHistoryTierFilterChange: (value: string) => void;
  onHistoryNameFilterChange: (value: string) => void;
  onHistoryOrderChange: (value: "desc" | "asc") => void;
};

export function HistoryPanel({
  panelTitle,
  showRemovedHistory,
  historyTierFilter,
  historyTierOptions,
  historyNameFilter,
  historyOrder,
  filteredHistory,
  currentTierByAnimeId,
  tierLabelMap,
  onToggleShowRemovedHistory,
  onHistoryTierFilterChange,
  onHistoryNameFilterChange,
  onHistoryOrderChange,
}: HistoryPanelProps) {
  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{panelTitle}</h2>
        <div className="history-actions">
          <button
            className={`ghost ${showRemovedHistory ? "active" : ""}`}
            onClick={onToggleShowRemovedHistory}
          >
            {showRemovedHistory ? "隐藏删除记录" : "显示删除记录"}
          </button>
          <span>按 rank</span>
          <select
            value={historyTierFilter}
            onChange={(event) => onHistoryTierFilterChange(event.target.value)}
          >
            <option value="all">全部等级</option>
            {historyTierOptions.map((tier) => (
              <option key={tier} value={tier}>
                {tierLabelMap.get(tier) || tier}
              </option>
            ))}
          </select>
          <span>名称</span>
          <input
            value={historyNameFilter}
            onChange={(event) => onHistoryNameFilterChange(event.target.value)}
            placeholder="搜索历史名称"
          />
          <span>按时间</span>
          <select
            value={historyOrder}
            onChange={(event) =>
              onHistoryOrderChange(event.target.value as "desc" | "asc")
            }
          >
            <option value="desc">最新在前</option>
            <option value="asc">最早在前</option>
          </select>
        </div>
      </div>
      <div className="history-list">
        {filteredHistory.length === 0 ? <p>暂无符合条件的历史记录</p> : null}
        {filteredHistory.map((record, index) => (
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
                {(record.action || "add") === "remove"
                  ? "删除时间 "
                  : "添加时间 "}
                {new Date(record.addedAt).toLocaleString("zh-CN")}
              </p>
              <p className="history-time">
                Rank:{" "}
                {(() => {
                  const currentTier = currentTierByAnimeId.get(record.animeId);

                  if (currentTier) {
                    return tierLabelMap.get(currentTier) || currentTier;
                  }

                  return (record.action || "add") === "remove"
                    ? "已删除"
                    : "未知";
                })()}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
