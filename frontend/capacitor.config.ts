import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.fusionengine.servemyfood.staff",
  appName: "ServeMyFood Staff",
  webDir: "dist",
  android: {
    path: "../mobile/android",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#0B1F3B",
      launchAutoHide: true,
      launchShowDuration: 1500,
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#0B1F3B",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
