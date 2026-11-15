import type { CapacitorConfig } from '@capacitor/cli';
import { pilotOrigin } from './config-origin.mjs';

// Pilot only: never embed credentials or activation tokens. Generated assets are ignored.
const origin = pilotOrigin(process.env.WORKFORCE_ANDROID_ORIGIN);
const config: CapacitorConfig = {
  appId: 'com.workforce.reporting.pilot',
  appName: 'Workforce',
  webDir: 'www',
  loggingBehavior: 'none',
  server: { url: origin, appStartPath: '/employee', cleartext: false, errorPath: 'offline.html' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
