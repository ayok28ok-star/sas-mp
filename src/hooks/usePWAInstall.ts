import { useCallback, useEffect, useMemo, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __sasDeferredPrompt?: BeforeInstallPromptEvent | null;
    __sasPwaInstalled?: boolean;
    __sasSwReady?: boolean;
    __sasSwError?: boolean;
  }
}

export type InstallOutcomeStatus =
  | 'idle'
  | 'installing'
  | 'installed'
  | 'dismissed'
  | 'unavailable';

function readEarlyPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__sasDeferredPrompt || null;
}

function readStandaloneState(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.__sasPwaInstalled) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function buildAutoInstallUrl(): string {
  if (typeof window === 'undefined') return '/?sas_install=1';
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('sas_install', '1');
    return url.toString();
  } catch {
    return '/?sas_install=1';
  }
}

export function downloadSasLauncherFile(schoolName = 'SAS (Sistem Absensi Siswa)') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const targetUrl = window.location.origin + window.location.pathname;
  const safeName = schoolName.replace(/[<>&"']/g, '');
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Membuka ${safeName}...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 10px 30px rgba(15,23,42,.08); }
    .btn { display: inline-block; margin-top: 16px; padding: 12px 22px; background: #059669; color: #fff; text-decoration: none; font-weight: 700; border-radius: 12px; font-size: 14px; }
    p { font-size: 13px; color: #475569; line-height: 1.5; }
  </style>
  <script>
    window.location.replace(${JSON.stringify(targetUrl + '?sas_install=1')});
  </script>
</head>
<body>
  <div class="card">
    <h1 style="margin:0 0 8px;font-size:18px;">SAS (Sistem Absensi Siswa)</h1>
    <p>${safeName}</p>
    <p>Mengalihkan ke aplikasi SAS. Jika tidak terbuka otomatis, klik tombol di bawah ini:</p>
    <a class="btn" href="${targetUrl}?sas_install=1">Buka &amp; Instal Aplikasi SAS</a>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'SAS-Absensi-Launcher.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    readEarlyPrompt()
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => readStandaloneState());
  const [installStatus, setInstallStatus] = useState<InstallOutcomeStatus>(() =>
    readStandaloneState() ? 'installed' : 'idle'
  );
  const [swReady, setSwReady] = useState<boolean>(() =>
    typeof window !== 'undefined' ? Boolean(window.__sasSwReady) : false
  );
  const [autoInstallRequested, setAutoInstallRequested] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('sas_install') === '1';
    } catch {
      return false;
    }
  });

  const deviceInfo = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        isIOS: false,
        isAndroid: false,
        isWindows: false,
        isMac: false,
        isDesktop: true,
        isInIframe: false,
        browserName: 'Chrome',
        deviceLabel: 'PC / Laptop',
      };
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isWindows = /windows/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
    const isMobile = isIOS || isAndroid || /mobile/.test(ua);
    const isEdge = /edg\//.test(ua) || /edga\//.test(ua) || /edgios\//.test(ua);
    const isFirefox = /firefox|fxios/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|chromium|edg|opr/.test(ua);
    const browserName = isEdge ? 'Microsoft Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Google Chrome';

    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
    const deviceLabel = isIOS
      ? 'iPhone / iPad'
      : isAndroid
      ? 'HP Android'
      : isMobile
      ? 'Perangkat Mobile'
      : isWindows
      ? 'PC Windows'
      : isMac
      ? 'Mac / MacBook'
      : 'PC / Laptop';

    return {
      isIOS,
      isAndroid,
      isWindows,
      isMac,
      isDesktop: !isMobile,
      isInIframe,
      browserName,
      deviceLabel,
    };
  }, []);

  useEffect(() => {
    setIsInstalled(readStandaloneState());
    const existing = readEarlyPrompt();
    if (existing) {
      setDeferredPrompt(existing);
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg?.active) {
            window.__sasSwReady = true;
            setSwReady(true);
          }
          return navigator.serviceWorker.ready;
        })
        .then(() => {
          window.__sasSwReady = true;
          setSwReady(true);
        })
        .catch(() => {
          // ignore SW readiness check error
        });
    }

    const syncEarlyPrompt = () => {
      const promptEvt = readEarlyPrompt();
      if (promptEvt) {
        setDeferredPrompt(promptEvt);
      }
    };

    const syncSwReady = () => {
      setSwReady(true);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      window.__sasDeferredPrompt = bip;
      setDeferredPrompt(bip);
    };

    const handleAppInstalled = () => {
      window.__sasDeferredPrompt = null;
      window.__sasPwaInstalled = true;
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallStatus('installed');
    };

    const displayMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayChange = (evt: MediaQueryListEvent) => {
      if (evt.matches) {
        handleAppInstalled();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('sas:pwa-ready', syncEarlyPrompt);
    window.addEventListener('sas:pwa-installed', handleAppInstalled);
    window.addEventListener('sas:sw-ready', syncSwReady);
    if (displayMedia && typeof displayMedia.addEventListener === 'function') {
      displayMedia.addEventListener('change', handleDisplayChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('sas:pwa-ready', syncEarlyPrompt);
      window.removeEventListener('sas:pwa-installed', handleAppInstalled);
      window.removeEventListener('sas:sw-ready', syncSwReady);
      if (displayMedia && typeof displayMedia.removeEventListener === 'function') {
        displayMedia.removeEventListener('change', handleDisplayChange);
      }
    };
  }, []);

  const clearAutoInstallParam = useCallback(() => {
    setAutoInstallRequested(false);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('sas_install')) {
        url.searchParams.delete('sas_install');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore URL cleanup error
    }
  }, []);

  const recheckInstallability = useCallback(() => {
    const promptEvt = readEarlyPrompt();
    if (promptEvt) {
      setDeferredPrompt(promptEvt);
      return true;
    }
    if (readStandaloneState()) {
      setIsInstalled(true);
      setInstallStatus('installed');
      return true;
    }
    return false;
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || readEarlyPrompt();
    if (!promptEvent) {
      setInstallStatus('unavailable');
      return false;
    }

    setInstallStatus('installing');
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        window.__sasDeferredPrompt = null;
        window.__sasPwaInstalled = true;
        setIsInstalled(true);
        setDeferredPrompt(null);
        setInstallStatus('installed');
        clearAutoInstallParam();
        window.dispatchEvent(new CustomEvent('sas:pwa-installed'));
        return true;
      }
      setInstallStatus('dismissed');
      return false;
    } catch {
      setInstallStatus('unavailable');
      return false;
    }
  }, [deferredPrompt, clearAutoInstallParam]);

  return {
    isInstallable: Boolean(deferredPrompt || readEarlyPrompt()),
    isInstalled,
    installStatus,
    swReady,
    isIOS: deviceInfo.isIOS,
    isAndroid: deviceInfo.isAndroid,
    isWindows: deviceInfo.isWindows,
    isMac: deviceInfo.isMac,
    isDesktop: deviceInfo.isDesktop,
    isInIframe: deviceInfo.isInIframe,
    browserName: deviceInfo.browserName,
    deviceLabel: deviceInfo.deviceLabel,
    autoInstallRequested,
    autoInstallUrl: buildAutoInstallUrl(),
    clearAutoInstallParam,
    recheckInstallability,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
