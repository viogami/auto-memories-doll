import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";

import {
  compactGrid,
  normalizeBangumiSubject,
  toNineGrid,
  type Anime,
  type AnimeItem,
  useAnimeStore,
} from "@repo/anime-core";

const tierOrder = ["S", "A", "B", "C", "Unrated"] as const;

export default function App() {
  const [keyword, setKeyword] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [results, setResults] = useState<Anime[]>([]);

  const list = useAnimeStore((state) => state.list);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(
          "https://api.bgm.tv/v0/search/subjects?limit=12",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "auto-memories-doll/1.0.0",
            },
            body: JSON.stringify({
              keyword,
              sort: "rank",
              filter: {
                type: [2],
              },
            }),
          },
        );

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as {
          data?: Array<{
            id: number;
            name: string;
            name_cn?: string;
            score?: number;
            images?: {
              common?: string;
              large?: string;
              small?: string;
            };
          }>;
        };

        setResults((json.data || []).map(normalizeBangumiSubject));
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [keyword]);

  const counts = useMemo(() => {
    return tierOrder.reduce<Record<string, number>>((acc, tier) => {
      acc[tier] = list.filter((item) => item.tier === tier).length;
      return acc;
    }, {});
  }, [list]);

  const grid = compactGrid(toNineGrid(list));

  const renderRankItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<AnimeItem>) => {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={styles.rankItem}
        >
          <Image source={{ uri: item.cover }} style={styles.cover} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.score}>Bangumi {item.score.toFixed(1)}</Text>
            <View style={styles.tierRow}>
              {tierOrder.map((tier) => (
                <Pressable
                  key={tier}
                  onPress={() => updateTier(item.id, tier)}
                  style={[styles.tier, item.tier === tier && styles.tierActive]}
                >
                  <Text
                    style={
                      item.tier === tier
                        ? styles.tierTextActive
                        : styles.tierText
                    }
                  >
                    {tier}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>auto-memories-doll</Text>
        <Text style={styles.desc}>跨端动漫管理：搜索、收藏、Rank、九宫格</Text>

        <View style={styles.panel}>
          <Text style={styles.h2}>计数器</Text>
          <Text style={styles.counter}>总数 {list.length}</Text>
          <View style={styles.countRow}>
            {tierOrder.map((tier) => (
              <View key={tier} style={styles.countCell}>
                <Text style={styles.countTier}>{tier}</Text>
                <Text style={styles.countNum}>{counts[tier] ?? 0}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.h2}>搜索 Bangumi</Text>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="输入动漫名"
            style={styles.input}
          />
          {isLoading ? (
            <ActivityIndicator style={{ marginVertical: 10 }} />
          ) : null}
          <View style={{ gap: 10 }}>
            {results.map((item) => (
              <View style={styles.result} key={item.id}>
                <Image source={{ uri: item.cover }} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.name}</Text>
                  <Text style={styles.score}>{item.score.toFixed(1)}</Text>
                </View>
                <Pressable onPress={() => addAnime(item)} style={styles.addBtn}>
                  <Text style={styles.addText}>加入</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.h2}>Rank（长按拖拽）</Text>
          <DraggableFlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRankItem}
            onDragEnd={({ data }) => reorder(data)}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.h2}>九宫格预览</Text>
          <View style={styles.grid}>
            {grid.map((item, index) => (
              <View
                style={styles.gridCell}
                key={`${item?.id ?? "empty"}-${index}`}
              >
                {item ? (
                  <>
                    <Image
                      source={{ uri: item.cover }}
                      style={styles.gridCover}
                    />
                    <Text numberOfLines={1} style={styles.gridText}>
                      {item.name}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.empty}>空位</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eff3f9",
  },
  container: {
    padding: 16,
    gap: 12,
  },
  h1: {
    fontSize: 26,
    fontWeight: "700",
    color: "#14243c",
  },
  desc: {
    color: "#506179",
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a3150",
  },
  counter: {
    fontWeight: "600",
    color: "#334862",
  },
  countRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  countCell: {
    width: 60,
    backgroundColor: "#f6f9ff",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  countTier: {
    color: "#5b6f8c",
    fontSize: 12,
  },
  countNum: {
    fontWeight: "700",
    color: "#1c3658",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d6e1ef",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e0e8f4",
    borderRadius: 10,
    padding: 8,
  },
  cover: {
    width: 50,
    height: 70,
    borderRadius: 6,
    backgroundColor: "#dce5f2",
  },
  title: {
    fontWeight: "700",
    color: "#1a3050",
  },
  score: {
    color: "#607390",
    fontSize: 12,
    marginTop: 4,
  },
  addBtn: {
    backgroundColor: "#1a6fe8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addText: {
    color: "#fff",
    fontWeight: "600",
  },
  rankItem: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  tierRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  tier: {
    borderWidth: 1,
    borderColor: "#d5deec",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tierActive: {
    backgroundColor: "#1a6fe8",
    borderColor: "#1a6fe8",
  },
  tierText: {
    color: "#445a77",
    fontSize: 11,
  },
  tierTextActive: {
    color: "#fff",
    fontSize: 11,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridCell: {
    width: "31.5%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce4ef",
    minHeight: 115,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    backgroundColor: "#fff",
  },
  gridCover: {
    width: "100%",
    height: 90,
    borderRadius: 8,
  },
  gridText: {
    marginTop: 4,
    fontSize: 11,
    color: "#385273",
  },
  empty: {
    color: "#8ca0bc",
    fontSize: 12,
  },
});
