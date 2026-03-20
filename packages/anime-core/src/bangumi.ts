import type { Anime } from "./types";

type BangumiSubject = {
  id: number;
  name: string;
  name_cn?: string;
  score?: number;
  rating?: {
    score?: number;
  };
  images?: {
    small?: string;
    common?: string;
    large?: string;
  };
};

const DEFAULT_COVER =
  "https://dummyimage.com/300x420/e8eaf0/1f2937&text=No+Cover";

export function normalizeBangumiSubject(subject: BangumiSubject): Anime {
  const score = subject.score || subject.rating?.score || 0;

  return {
    id: subject.id,
    name: subject.name_cn || subject.name,
    cover:
      subject.images?.common ||
      subject.images?.large ||
      subject.images?.small ||
      DEFAULT_COVER,
    score,
  };
}

export async function searchBangumi(keyword: string): Promise<Anime[]> {
  const query = keyword.trim();

  if (!query) {
    return [];
  }

  const response = await fetch(
    `https://api.bgm.tv/v0/search/subjects?limit=20&offset=0`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "auto-memories-doll/1.0.0",
      },
      body: JSON.stringify({
        keyword: query,
        sort: "rank",
        filter: {
          type: [2],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Bangumi request failed: ${response.status}`);
  }

  const json = (await response.json()) as { data?: BangumiSubject[] };
  return (json.data || []).map(normalizeBangumiSubject);
}
