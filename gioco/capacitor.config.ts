import type { CapacitorConfig } from '@capacitor/cli';

// Configurazione di Capacitor (ARCHITETTURA 13). L'appId non si cambia mai dopo
// la prima pubblicazione: i salvataggi dipendono dall'origine della WebView.
const config: CapacitorConfig = {
  appId: 'it.trama.merletto',      // MAI cambiarlo dopo la prima pubblicazione
  appName: 'Trama',
  webDir: 'dist',
  backgroundColor: '#1C2233',
  ios: { contentInset: 'never', scrollEnabled: false },
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { hidden: true, insetsHandling: 'css', style: 'DARK' },
    SplashScreen: { launchAutoHide: false, showSpinner: false, backgroundColor: '#1C2233' },
  },
};
export default config;
