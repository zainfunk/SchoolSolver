import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.APP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.clubit.app',
  appName: 'ClubIt',
  webDir: 'public',
  server: {
    // In CI, APP_SERVER_URL is set to the deployed Vercel URL.
    // For local dev, run: APP_SERVER_URL=http://localhost:3000 npx cap sync ios
    ...(serverUrl ? { url: serverUrl } : {}),
    androidScheme: 'https',
  },
};

export default config;
