import type { HistoryRecord, RemovedHistoryRecord } from "@repo/anime-core";
import Image from "next/image";

type HistoryPanelProps = {
  panelTitle: string;
  showRemovedHistory: boolean;
  historyNameFilter: string;
  historyOrder: "desc" | "asc";
  filteredHistory: HistoryRecord[];
  filteredRemovedHistory: RemovedHistoryRecord[];
  onToggleShowRemovedHistory: () => void;
  onHistoryNameFilterChange: (value: string) => void;
  onHistoryOrderChange: (value: "desc" | "asc") => void;
};

export function HistoryPanel({
  panelTitle,
  showRemovedHistory,
  historyNameFilter,
  historyOrder,
  filteredHistory,
  filteredRemovedHistory,
  onToggleShowRemovedHistory,
  onHistoryNameFilterChange,
  onHistoryOrderChange,
}: HistoryPanelProps) {
  const displayRecords = showRemovedHistory
    ? filteredRemovedHistory
    : filteredHistory;

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{panelTitle}</h2>
        <div className="history-actions">
          <button
            className={`ghost ${showRemovedHistory ? "active" : ""}`}
            onClick={onToggleShowRemovedHistory}
          >
            {showRemovedHistory ? "查看添加历史" : "查看删除列表"}
          </button>
          <span>名称</span>
          <input
            value={historyNameFilter}
            onChange={(event) => onHistoryNameFilterChange(event.target.value)}
            placeholder={showRemovedHistory ? "搜索删除名称" : "搜索历史名称"}
          />
          <span>{showRemovedHistory ? "按删除时间" : "按添加时间"}</span>
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
        {displayRecords.length === 0 ? (
          <p>
            {showRemovedHistory
              ? "暂无符合条件的删除记录"
              : "暂无符合条件的历史记录"}
          </p>
        ) : null}

        {!showRemovedHistory
          ? filteredHistory.map((record, index) => (
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
                    添加时间 {new Date(record.addedAt).toLocaleString("zh-CN")}
                  </p>
                  <p className="history-time">
                    添加顺序 #{record.sequence || index + 1}
                  </p>
                </div>
              </article>
            ))
          : filteredRemovedHistory.map((record, index) => (
              <article
                className="history-item"
                key={`${record.animeId}-${record.removedAt}-${index}`}
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
                    删除时间{" "}
                    {new Date(record.removedAt).toLocaleString("zh-CN")}
                  </p>
                  {record.addedAt ? (
                    <p className="history-time">
                      最后添加时间{" "}
                      {new Date(record.addedAt).toLocaleString("zh-CN")}
                    </p>
                  ) : null}
                  {record.sequence ? (
                    <p className="history-time">
                      对应添加顺序 #{record.sequence}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
