import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const CLOUD_API_BASE = "http://localhost:8088";
const MOBILE_TOKEN_KEY = "am_mobile_cloud_token";
const MOBILE_USER_KEY = "am_mobile_cloud_username";

const tierOrder = ["S", "A", "B", "C", "Unrated"] as const;

export default function App() {
  const [keyword, setKeyword] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [historyOrder, setHistoryOrder] = useState<"desc" | "asc">("desc");
  const [results, setResults] = useState<Anime[]>([]);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [cloudMessage, setCloudMessage] = useState("未连接云端");
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const applyingCloudDataRef = useRef(false);
  const skipNextAutoSyncRef = useRef(false);
  const lastSyncedSnapshotRef = useRef("");

  const list = useAnimeStore((state) => state.list);
  const history = useAnimeStore((state) => state.history);
  const setList = useAnimeStore((state) => state.setList);
  const setHistory = useAnimeStore((state) => state.setHistory);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);

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
          title: "mobile 自动同步快照",
          tier_board_name: "MOBILE TIER BOARD",
          grid_board_name: "MOBILE GRID",
          payload: {
            list,
          },
        },
      }),
    [history, list],
  );

  const authedFetch = async (path: string, init?: RequestInit) => {
    if (!token) {
      throw new Error("请先登录");
    }

    return fetch(`${CLOUD_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  };

  const parseCloudPayload = (
    payload: unknown,
  ): {
    list?: AnimeItem[];
  } => {
    let raw = payload;

    if (typeof payload === "string") {
      try {
        raw = JSON.parse(payload);
      } catch {
        return {};
      }
    }

    if (!raw || typeof raw !== "object") {
      return {};
    }

    return raw as {
      list?: AnimeItem[];
    };
  };

  const loadCloudData = async () => {
    if (!token) {
      return;
    }

    setLoadingCloud(true);
    setCloudMessage("正在拉取云端数据...");

    try {
      applyingCloudDataRef.current = true;
      const meRes = await authedFetch("/api/v1/me");
      if (!meRes.ok) {
        throw new Error("会话失效，请重新登录");
      }
      const me = (await meRes.json()) as { username?: string };
      const username = me.username || "";
      setCurrentUser(username);
      if (username) {
        await AsyncStorage.setItem(MOBILE_USER_KEY, username);
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
        };
        const cloudHistory = (historyJson.items || []).map((item) => ({
          animeId: item.anime_id,
          name: item.name,
          cover: item.cover,
          addedAt: item.added_at || item.created_at || new Date().toISOString(),
        }));
        setHistory(cloudHistory);
      }

      const rankRes = await authedFetch("/api/v1/rank/latest");
      if (rankRes.ok) {
        const rankJson = (await rankRes.json()) as {
          item?: { payload?: unknown } | null;
        };
        const parsed = parseCloudPayload(rankJson.item?.payload);
        if (Array.isArray(parsed.list)) {
          setList(parsed.list);
        }
      }

      skipNextAutoSyncRef.current = true;
      lastSyncedSnapshotRef.current = "";
      setCloudMessage("云端同步完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "拉取失败";
      setCloudMessage(message);
      if (message.includes("会话失效")) {
        setToken("");
        setCurrentUser("");
        await AsyncStorage.removeItem(MOBILE_TOKEN_KEY);
      }
    } finally {
      applyingCloudDataRef.current = false;
      setLoadingCloud(false);
    }
  };

  const syncToCloud = async (silent?: boolean) => {
    if (!token) {
      if (!silent) {
        setCloudMessage("请先登录");
      }
      return;
    }

    setSyncingCloud(true);
    if (!silent) {
      setCloudMessage("上传中...");
    }

    try {
      const response = await authedFetch("/api/v1/sync", {
        method: "POST",
        body: cloudSnapshot,
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "上传失败");
      }

      lastSyncedSnapshotRef.current = cloudSnapshot;
      if (!silent) {
        setCloudMessage("云端已保存当前数据");
      }
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setSyncingCloud(false);
    }
  };

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
      const response = await fetch(`${CLOUD_API_BASE}/api/v1/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
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
      await AsyncStorage.setItem(MOBILE_TOKEN_KEY, json.token);
      await AsyncStorage.setItem(MOBILE_USER_KEY, json.username || username);
      setCloudMessage(mode === "login" ? "登录成功" : "注册并登录成功");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "认证失败");
    } finally {
      setLoadingCloud(false);
    }
  };

  const logout = async () => {
    setToken("");
    setCurrentUser("");
    setCloudMessage("已退出登录");
    await AsyncStorage.removeItem(MOBILE_TOKEN_KEY);
    await AsyncStorage.removeItem(MOBILE_USER_KEY);
  };

  useEffect(() => {
    const initCloud = async () => {
      const savedToken = (await AsyncStorage.getItem(MOBILE_TOKEN_KEY)) || "";
      const savedUser = (await AsyncStorage.getItem(MOBILE_USER_KEY)) || "";

      if (savedToken) {
        setToken(savedToken);
      }
      if (savedUser) {
        setCurrentUser(savedUser);
        setAuthUsername(savedUser);
      }
    };

    void initCloud();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void AsyncStorage.setItem(MOBILE_TOKEN_KEY, token);
    void loadCloudData();
  }, [token]);

  useEffect(() => {
    if (!token || !autoSyncEnabled || applyingCloudDataRef.current) {
      return;
    }

    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }

    if (cloudSnapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void syncToCloud(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, [autoSyncEnabled, cloudSnapshot, token]);

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

  const sortedHistory = useMemo(() => {
    const next = [...history].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
    );

    return historyOrder === "asc" ? next : next.reverse();
  }, [history, historyOrder]);

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
          <View style={styles.cloudHead}>
            <Text style={styles.h2}>云端同步</Text>
            <Text
              style={[styles.badge, token ? styles.online : styles.offline]}
            >
              {token ? "已连接" : "未登录"}
            </Text>
          </View>
          <Text style={styles.score}>
            {currentUser
              ? `当前用户：${currentUser}`
              : "登录后与 Web 端共享数据"}
          </Text>
          <TextInput
            value={authUsername}
            onChangeText={setAuthUsername}
            placeholder="用户名"
            style={styles.input}
          />
          <TextInput
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="密码"
            secureTextEntry
            style={styles.input}
          />
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void submitAuth("login")}
              style={styles.addBtn}
              disabled={loadingCloud}
            >
              <Text style={styles.addText}>登录</Text>
            </Pressable>
            <Pressable
              onPress={() => void submitAuth("register")}
              style={styles.ghostBtn}
              disabled={loadingCloud}
            >
              <Text style={styles.ghostText}>注册</Text>
            </Pressable>
            <Pressable
              onPress={() => void logout()}
              style={styles.ghostBtn}
              disabled={!token}
            >
              <Text style={styles.ghostText}>退出</Text>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void loadCloudData()}
              style={styles.ghostBtn}
              disabled={!token || loadingCloud}
            >
              <Text style={styles.ghostText}>拉取云端</Text>
            </Pressable>
            <Pressable
              onPress={() => void syncToCloud()}
              style={styles.addBtn}
              disabled={!token || syncingCloud}
            >
              <Text style={styles.addText}>
                {syncingCloud ? "上传中..." : "立即上传"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.autoSyncRow}>
            <Text style={styles.score}>自动同步（变更后 1.8 秒）</Text>
            <Switch
              value={autoSyncEnabled}
              onValueChange={setAutoSyncEnabled}
            />
          </View>
          <Text style={styles.cloudMessage}>{cloudMessage}</Text>
        </View>

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

        <View style={styles.panel}>
          <Text style={styles.h2}>历史记录</Text>
          <View style={styles.tierRow}>
            <Text style={styles.score}>按时间排序</Text>
            <View style={styles.tierRow}>
              <Pressable
                onPress={() => setHistoryOrder("desc")}
                style={[
                  styles.tier,
                  historyOrder === "desc" && styles.tierActive,
                ]}
              >
                <Text
                  style={
                    historyOrder === "desc"
                      ? styles.tierTextActive
                      : styles.tierText
                  }
                >
                  最新
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHistoryOrder("asc")}
                style={[
                  styles.tier,
                  historyOrder === "asc" && styles.tierActive,
                ]}
              >
                <Text
                  style={
                    historyOrder === "asc"
                      ? styles.tierTextActive
                      : styles.tierText
                  }
                >
                  最早
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {sortedHistory.map((record, index) => (
              <View
                style={styles.result}
                key={`${record.animeId}-${record.addedAt}-${index}`}
              >
                <Image source={{ uri: record.cover }} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{record.name}</Text>
                  <Text style={styles.score}>
                    {new Date(record.addedAt).toLocaleString("zh-CN")}
                  </Text>
                </View>
              </View>
            ))}
            {sortedHistory.length === 0 ? (
              <Text style={styles.score}>还没有添加记录</Text>
            ) : null}
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
  ghostBtn: {
    backgroundColor: "#eef3fb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ghostText: {
    color: "#35557d",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cloudHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  online: {
    backgroundColor: "#dff8e8",
    color: "#145a3a",
  },
  offline: {
    backgroundColor: "#eef2f7",
    color: "#5d6f86",
  },
  autoSyncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cloudMessage: {
    borderWidth: 1,
    borderColor: "#d8e3f3",
    borderRadius: 10,
    backgroundColor: "#f4f8ff",
    color: "#2c496f",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
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
