# Web MVP Packaging (Android + Windows)

This document provides the fastest path to package the existing web app into Android APK and Windows desktop app.

## 1. Install dependencies

From repository root:

```bash
npm install
```

## 2. Android APK (Capacitor shell)

Current setup uses `server.url` to load deployed web app directly.
Default URL: `https://auto-memories-doll-web.vercel.app`

You can override at runtime:

```bash
set CAP_WEB_URL=https://your-web-domain.example.com
```

Initialize Android project once:

```bash
npm run android:add --workspace=web
```

Sync web config to Android project:

```bash
npm run android:sync --workspace=web
```

Open Android Studio project:

```bash
npm run android:open --workspace=web
```

Then build APK inside Android Studio:

- Build > Build Bundle(s) / APK(s) > Build APK(s)

## 3. Windows desktop app (Electron)

### Development mode (load local Next server)

```bash
npm run desktop:dev --workspace=web
```

This starts Next at `http://localhost:3000` and launches Electron.

### Package to installer (.exe)

```bash
npm run desktop:pack --workspace=web
```

The generated installer will be in `apps/web/dist/`.

### Package to unpacked app directory (more stable)

```bash
npm run desktop:pack:dir --workspace=web
```

This command packs to a timestamped folder, for example:

- `apps/web/dist/pack-20260321-153000/win-unpacked/AutoMemoriesDoll.exe`

This avoids common lock conflicts on a fixed `dist/win-unpacked` path.

## 4. Notes

- This MVP packaging keeps your current code untouched and wraps the web app as-is.
- If you need fully offline APK/desktop, the Next server route under `app/api/**` must be replaced by external APIs or moved to a separate backend service.
