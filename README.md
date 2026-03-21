# auto-memories-doll 👉[立即体验](https://auto-memories-doll-web.vercel.app/)

跨端动漫管理应用（Web + Mobile），前端为静态页面，可以单独启动，数据保存在本地。

`C.H`文件夹下为后端代码，为支持保存的数据上传云端。go原生库编写，实现非常简单，也非常高效。
👉[后端文档](./C.H/README.md)

核心功能：

- Bangumi 搜索
- 个人收藏列表总览
- Rank 拖拽排序 + Tier（S/A/B/C/Unrated）
- tier rank图生成器
- 九宫格生成与排序，导出 PNG！
- 动画收藏历史记录，记录你的时刻！
- rank等级文本，颜色，完全自定义配置！
- 支持上传云端，永远保存你的记录！

![alt text](static/app-0.png)
![alt text](static/app-1.png)
![alt text](static/app-2.png)
![alt text](static/app-3.png)

## 前端完全由ai生成

一句话自动生成设计图，设计方案，用ai把图和方案解析为codex提示词，喂给codex，全程allow后生成代码库。

生成后手动调优接口，后端由本人独立编写，使用pg数据库，闭源开发。

给ai大人跪了，甚至自动知道调用bangumi的api，而且调用逻辑完成正确，我的天，甚至甚至包括这个md文件都是ai执笔😲

![ai生成设计方案](static/ai-.png)

## 多端构建

使用next，原生支持web，可用electron打包桌面端，移动端也构建了快速打包方案。

- `apps/docs` 文档站，未用，保留
- `apps/mobile` 移动端，可用EAS云端构建
- `apps/web` 包含网页端和electron构建，PACKAGING.md文档有详细构建说明

## Monorepo 结构

```text
apps/
 web/      Next.js Web
 mobile/   Expo React Native
 docs/     文档站（保留）

packages/
 anime-core/  共享类型、store、算法、Bangumi 请求
 ui/          共享 UI 示例组件
```

## 快速启动

前端可以单独启动，数据保存本地

```bash
npm install
```

启动 Web：

```bash
npm run dev --workspace=web
```

启动 Mobile（Expo）：

```bash
npm run dev --workspace=mobile
```

## 已实现的共享策略

- 共享：类型定义、Bangumi 请求封装、Tier 规则、九宫格算法、Zustand store
- 端差异：渲染层和交互层（Web 使用 dnd-kit，Mobile 使用 react-native-draggable-flatlist）

## 关键文件

- `apps/web/app/sections/anime-dashboard.tsx`
- `apps/web/app/config/dashboard-config.ts`
- `apps/web/app/api/anime/route.ts`
- `apps/mobile/App.tsx`
- `packages/anime-core/src/store.ts`
- `packages/anime-core/src/rank.ts`
- `packages/anime-core/src/grid.ts`

## 👉[更详细的本人博客](https://viogami.github.io/blog/project/auto-memories-doll/index.html)
