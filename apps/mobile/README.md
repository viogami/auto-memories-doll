# mobile

Expo app for auto-memories-doll.

## Start

```bash
npm run dev --workspace=mobile
```

## Build APK Without Android Studio (EAS Cloud)

Install EAS CLI once:

```bash
npm install -g eas-cli
```

Login to Expo:

```bash
eas login
```

Build APK in cloud:

```bash
npm run apk:cloud --workspace=mobile
```

After build finishes, open download URL:

```bash
eas build:list --platform android --limit 1
```

## Core MVP

- Bangumi search
- 收藏列表
- 拖拽 Rank
- 九宫格预览
