import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
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
import * as Sharing from "expo-sharing";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { captureRef } from "react-native-view-shot";

import {
  compactGrid,
  normalizeBangumiSubject,
  toNineGrid,
  type Anime,
  type AnimeItem,
  useAnimeStore,
} from "@repo/anime-core";

const CH_API_BASE =
  process.env.EXPO_PUBLIC_CH_API_BASE?.trim() ||
  process.env.CH_API_BASE?.trim() ||
  "http://localhost:8080/CH";
const MOBILE_TOKEN_KEY =
  process.env.EXPO_PUBLIC_MOBILE_TOKEN_KEY?.trim() || "am_mobile_cloud_token";
const MOBILE_USER_KEY =
  process.env.EXPO_PUBLIC_MOBILE_USER_KEY?.trim() || "am_mobile_cloud_username";

type PanelKey =
  | "cloud"
  | "search"
  | "rank"
  | "tier"
  | "grid"
  | "history"
  | "editor";

type TierLevelConfig = {
  tier: string;
  label: string;
  color: string;
};

type DashboardConfig = {
  sidebarTitle: string;
  sidebarHint: string;
  defaultPanels: PanelKey[];
  panelTitles: Record<PanelKey, string>;
  tierBoardName: string;
  gridBoardName: string;
  tierLevels: TierLevelConfig[];
};

const DASHBOARD_CONFIG: DashboardConfig = {
  sidebarTitle: "功能面板",
  sidebarHint: "移动端通过侧边栏按钮切换显示模块",
  defaultPanels: ["search", "rank"],
  panelTitles: {
    cloud: "云端同步",
    search: "搜索 Bangumi",
    rank: "Rank（长按拖拽）",
    tier: "Tier 图生成器",
    grid: "九宫格预览",
    history: "历史记录",
    editor: "自定义配置",
  },
  tierBoardName: "MOBILE TIER BOARD",
  gridBoardName: "MOBILE GRID",
  tierLevels: [
    { tier: "S", label: "BEST", color: "#6be77a" },
    { tier: "A", label: "GREAT", color: "#f57878" },
    { tier: "B", label: "GOOD", color: "#f3be7d" },
    { tier: "C", label: "MAYBE", color: "#f5dd79" },
    { tier: "Unrated", label: "IDK", color: "#acef73" },
  ],
};

const createInitialConfig = (): DashboardConfig => ({
  ...DASHBOARD_CONFIG,
  panelTitles: { ...DASHBOARD_CONFIG.panelTitles },
  tierLevels: DASHBOARD_CONFIG.tierLevels.map((item) => ({ ...item })),
});

function normalizeConfig(
  input: unknown,
  fallback: DashboardConfig,
): DashboardConfig {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const source = input as Partial<DashboardConfig>;
  const levels = Array.isArray(source.tierLevels)
    ? source.tierLevels
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const row = item as Partial<TierLevelConfig>;
          const tier = typeof row.tier === "string" ? row.tier.trim() : "";
          if (!tier) {
            return null;
          }

          return {
            tier,
            label:
              typeof row.label === "string" && row.label.trim()
                ? row.label
                : tier,
            color:
              typeof row.color === "string" && row.color.trim()
                ? row.color
                : "#9cc5ff",
          };
        })
        .filter((item): item is TierLevelConfig => item !== null)
    : fallback.tierLevels;

  return {
    ...fallback,
    ...source,
    panelTitles: {
      ...fallback.panelTitles,
      ...(source.panelTitles || {}),
    },
    defaultPanels:
      Array.isArray(source.defaultPanels) && source.defaultPanels.length > 0
        ? source.defaultPanels
        : fallback.defaultPanels,
    tierLevels: levels.length > 0 ? levels : fallback.tierLevels,
  };
}

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
  const [uiConfig, setUiConfig] =
    useState<DashboardConfig>(createInitialConfig);
  const [activePanels, setActivePanels] = useState<PanelKey[]>(
    DASHBOARD_CONFIG.defaultPanels,
  );
  const [isExportingTier, setIsExportingTier] = useState(false);

  const applyingCloudDataRef = useRef(false);
  const skipNextAutoSyncRef = useRef(false);
  const lastSyncedSnapshotRef = useRef("");
  const tierBoardRef = useRef<View>(null);

  const list = useAnimeStore((state) => state.list);
  const history = useAnimeStore((state) => state.history);
  const setList = useAnimeStore((state) => state.setList);
  const setHistory = useAnimeStore((state) => state.setHistory);
  const addAnime = useAnimeStore((state) => state.addAnime);
  const reorder = useAnimeStore((state) => state.reorder);
  const updateTier = useAnimeStore((state) => state.updateTier);
  const remapTier = useAnimeStore((state) => state.remapTier);

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
          title: "mobile 自动同步快照",
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

  const authedFetch = async (path: string, init?: RequestInit) => {
    if (!token) {
      throw new Error("请先登录");
    }

    return fetch(`${CH_API_BASE}${path}`, {
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
    uiConfig?: DashboardConfig;
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
      uiConfig?: DashboardConfig;
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
        if (parsed.uiConfig) {
          setUiConfig((state) => normalizeConfig(parsed.uiConfig, state));
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
      const response = await fetch(`${CH_API_BASE}/api/v1/auth/${mode}`, {
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
    return uiConfig.tierLevels.reduce<Record<string, number>>((acc, level) => {
      acc[level.tier] = list.filter((item) => item.tier === level.tier).length;
      return acc;
    }, {});
  }, [list, uiConfig.tierLevels]);

  const grid = compactGrid(toNineGrid(list));

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

  const isVisible = (key: PanelKey) => activePanels.includes(key);

  const togglePanel = (key: PanelKey) => {
    setActivePanels((state) => {
      if (state.includes(key)) {
        return state.filter((item) => item !== key);
      }

      return [...state, key];
    });
  };

  const exportTierBoard = async () => {
    if (!tierBoardRef.current) {
      return;
    }

    setIsExportingTier(true);

    try {
      const uri = await captureRef(tierBoardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "分享 Tier 图",
        });
      } else if (Platform.OS === "web") {
        Alert.alert("提示", "Web 端请使用桌面端导出图功能");
      } else {
        setCloudMessage("当前设备不支持分享导出");
      }
    } catch (error) {
      setCloudMessage(
        error instanceof Error ? error.message : "Tier 图导出失败",
      );
    } finally {
      setIsExportingTier(false);
    }
  };

  const updateTierLevelField = (
    tier: string,
    field: "label" | "color",
    value: string,
  ) => {
    setUiConfig((state) => ({
      ...state,
      tierLevels: state.tierLevels.map((item) =>
        item.tier === tier
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  };

  const addTierLevel = () => {
    const suffix = uiConfig.tierLevels.length + 1;
    const tier = `T${suffix}`;
    if (uiConfig.tierLevels.some((item) => item.tier === tier)) {
      return;
    }

    setUiConfig((state) => ({
      ...state,
      tierLevels: [
        ...state.tierLevels,
        {
          tier,
          label: tier,
          color: "#9cc5ff",
        },
      ],
    }));
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
              {uiConfig.tierLevels.map((level) => (
                <Pressable
                  key={level.tier}
                  onPress={() => updateTier(item.id, level.tier)}
                  style={[
                    styles.tier,
                    item.tier === level.tier && styles.tierActive,
                  ]}
                >
                  <Text
                    style={
                      item.tier === level.tier
                        ? styles.tierTextActive
                        : styles.tierText
                    }
                  >
                    {level.label}
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
          <Text style={styles.h2}>{uiConfig.sidebarTitle}</Text>
          <Text style={styles.score}>{uiConfig.sidebarHint}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sidebarNav}
          >
            {panelItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => togglePanel(item.key)}
                style={[
                  styles.sidebarChip,
                  isVisible(item.key) && styles.sidebarChipActive,
                ]}
              >
                <Text
                  style={
                    isVisible(item.key)
                      ? styles.sidebarChipTextActive
                      : styles.sidebarChipText
                  }
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {isVisible("cloud") ? (
          <View style={styles.panel}>
            <View style={styles.cloudHead}>
              <Text style={styles.h2}>{uiConfig.panelTitles.cloud}</Text>
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
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.h2}>计数器</Text>
          <Text style={styles.counter}>总数 {list.length}</Text>
          <View style={styles.countRow}>
            {uiConfig.tierLevels.map((level) => (
              <View key={level.tier} style={styles.countCell}>
                <Text style={styles.countTier}>{level.label}</Text>
                <Text style={styles.countNum}>{counts[level.tier] ?? 0}</Text>
              </View>
            ))}
          </View>
        </View>

        {isVisible("search") ? (
          <View style={styles.panel}>
            <Text style={styles.h2}>{uiConfig.panelTitles.search}</Text>
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
                  <Pressable
                    onPress={() => addAnime(item)}
                    style={styles.addBtn}
                  >
                    <Text style={styles.addText}>加入</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {isVisible("rank") ? (
          <View style={styles.panel}>
            <Text style={styles.h2}>{uiConfig.panelTitles.rank}</Text>
            <DraggableFlatList
              data={list}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRankItem}
              onDragEnd={({ data }) => reorder(data)}
              scrollEnabled={false}
            />
          </View>
        ) : null}

        {isVisible("tier") ? (
          <View style={styles.panel}>
            <View style={styles.cloudHead}>
              <Text style={styles.h2}>{uiConfig.panelTitles.tier}</Text>
              <Pressable
                onPress={() => void exportTierBoard()}
                style={styles.addBtn}
                disabled={isExportingTier || list.length === 0}
              >
                <Text style={styles.addText}>
                  {isExportingTier ? "生成中..." : "生成并分享"}
                </Text>
              </Pressable>
            </View>

            <View ref={tierBoardRef} style={styles.tierBoard}>
              <Text style={styles.tierBoardTitle}>
                {uiConfig.tierBoardName}
              </Text>
              {tierGroups.map((group) => (
                <View key={group.tier} style={styles.tierBoardRow}>
                  <View
                    style={[
                      styles.tierBoardLabel,
                      { backgroundColor: group.color },
                    ]}
                  >
                    <Text style={styles.tierBoardLabelText}>{group.label}</Text>
                  </View>
                  <View style={styles.tierBoardItems}>
                    {group.items.length === 0 ? (
                      <Text style={styles.empty}>暂无条目</Text>
                    ) : (
                      group.items.map((tierItem) => (
                        <Image
                          key={`tier-${tierItem.id}`}
                          source={{ uri: tierItem.cover }}
                          style={styles.tierAvatar}
                        />
                      ))
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {isVisible("grid") ? (
          <View style={styles.panel}>
            <Text style={styles.h2}>{uiConfig.panelTitles.grid}</Text>
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
        ) : null}

        {isVisible("history") ? (
          <View style={styles.panel}>
            <Text style={styles.h2}>{uiConfig.panelTitles.history}</Text>
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
        ) : null}

        {isVisible("editor") ? (
          <View style={styles.panel}>
            <Text style={styles.h2}>{uiConfig.panelTitles.editor}</Text>

            <Text style={styles.score}>Tier 图标题</Text>
            <TextInput
              value={uiConfig.tierBoardName}
              onChangeText={(value) =>
                setUiConfig((state) => ({
                  ...state,
                  tierBoardName: value,
                }))
              }
              placeholder="Tier 图标题"
              style={styles.input}
            />

            <Text style={styles.score}>九宫格标题</Text>
            <TextInput
              value={uiConfig.gridBoardName}
              onChangeText={(value) =>
                setUiConfig((state) => ({
                  ...state,
                  gridBoardName: value,
                }))
              }
              placeholder="九宫格标题"
              style={styles.input}
            />

            <View style={styles.actionRow}>
              <Pressable onPress={addTierLevel} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>新增 Tier 档位</Text>
              </Pressable>
            </View>

            <View style={{ gap: 8 }}>
              {uiConfig.tierLevels.map((level) => (
                <View key={level.tier} style={styles.editorRow}>
                  <Text style={styles.editorKey}>{level.tier}</Text>
                  <TextInput
                    value={level.label}
                    onChangeText={(value) =>
                      updateTierLevelField(level.tier, "label", value)
                    }
                    placeholder="显示名称"
                    style={[styles.input, styles.editorInput]}
                  />
                  <TextInput
                    value={level.color}
                    onChangeText={(value) =>
                      updateTierLevelField(level.tier, "color", value)
                    }
                    placeholder="#hex"
                    style={[styles.input, styles.editorColorInput]}
                  />
                  <Pressable
                    onPress={() => removeTierLevel(level.tier)}
                    style={styles.ghostBtn}
                  >
                    <Text style={styles.ghostText}>删</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
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
  sidebarNav: {
    gap: 8,
    paddingRight: 8,
  },
  sidebarChip: {
    borderWidth: 1,
    borderColor: "#d2dded",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f7fd",
  },
  sidebarChipActive: {
    backgroundColor: "#1a6fe8",
    borderColor: "#1a6fe8",
  },
  sidebarChipText: {
    color: "#3f5f86",
    fontSize: 12,
    fontWeight: "600",
  },
  sidebarChipTextActive: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
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
  tierBoard: {
    borderWidth: 1,
    borderColor: "#d8e4f3",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8fbff",
    gap: 8,
  },
  tierBoardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#213c63",
    marginBottom: 2,
  },
  tierBoardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tierBoardLabel: {
    width: 72,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tierBoardLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1a2230",
  },
  tierBoardItems: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 32,
  },
  tierAvatar: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: "#d5deec",
  },
  editorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editorKey: {
    width: 36,
    fontSize: 12,
    fontWeight: "700",
    color: "#3a567e",
  },
  editorInput: {
    flex: 1,
  },
  editorColorInput: {
    width: 96,
  },
});
