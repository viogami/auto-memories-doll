import type { CapacitorConfig } from "@capacitor/cli";

const defaultRemoteUrl = "https://auto-memories-doll-web.vercel.app";
const remoteUrl = process.env.CAP_WEB_URL || defaultRemoteUrl;

const config: CapacitorConfig = {
  appId: "com.viogami.memories.doll",
  appName: "AutoMemoriesDoll",
  webDir: "public",
  server: {
    // MVP: directly load deployed web app, no need to export static files.
    url: remoteUrl,
    cleartext: remoteUrl.startsWith("http://"),
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
