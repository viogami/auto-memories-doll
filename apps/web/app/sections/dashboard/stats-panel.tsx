import type { CSSProperties } from "react";

import type { DashboardConfig } from "../../config/dashboard-config";

type StatsPanelProps = {
  listCount: number;
  tierLevels: DashboardConfig["tierLevels"];
  tierCountMap: Record<string, number>;
  statUnknownCount: number;
};

export function StatsPanel({
  listCount,
  tierLevels,
  tierCountMap,
  statUnknownCount,
}: StatsPanelProps) {
  return (
    <section className="panel stats">
      <article className="stats-total-card">
        <span className="stats-label">总收藏</span>
        <strong>{listCount}</strong>
        <span className="stats-subtitle">实时条目总数</span>
      </article>
      {tierLevels.map((level) => (
        <article
          key={level.tier}
          className="stats-rank-card"
          style={{ borderColor: level.color } as CSSProperties}
        >
          <span className="stats-label">
            <span
              className="stats-dot"
              style={{ backgroundColor: level.color } as CSSProperties}
            />
            {level.label}
          </span>
          <strong>{tierCountMap[level.tier] || 0}</strong>
          <span className="stats-subtitle">Rank: {level.tier}</span>
        </article>
      ))}
      {statUnknownCount > 0 ? (
        <article className="stats-rank-card stats-rank-card-muted">
          <span className="stats-label">未配置层级</span>
          <strong>{statUnknownCount}</strong>
          <span className="stats-subtitle">不在当前 Rank 配置中</span>
        </article>
      ) : null}
    </section>
  );
}
