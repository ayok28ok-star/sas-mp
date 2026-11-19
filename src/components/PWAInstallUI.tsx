import React, { useEffect, useState } from 'react';
import {
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  X,
  ShieldCheck,
  Star,
  HardDrive,
  WifiOff,
  Share,
  MoreVertical,
  ExternalLink,
  ScanFace,
  MessageSquare,
  FileSpreadsheet,
  Loader2,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import {
  downloadSasLauncherFile,
  useOnlineStatus,
  usePWAInstall,
} from '../hooks/usePWAInstall';
import { SchoolLogo } from './SchoolLogo';

interface AppInstallStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
  schoolLogo?: string;
  accentColor?: string;
  autoOpened?: boolean;
}

export const AppInstallStoreModal: React.FC<AppInstallStoreModalProps> = ({
  isOpen,
  onClose,
  schoolName = 'Portal Pendidikan Resmi',
  schoolLogo,
  accentColor = '#059669',
  autoOpened = false,
}) => {
  const {
    isInstallable,
    isInstalled,
    installStatus,
    swReady,
    isIOS,
    isAndroid,
    isDesktop,
    isInIframe,
    browserName,
    deviceLabel,
    autoInstallUrl,
    recheckInstallability,
    install,
  } = usePWAInstall();
  const [waitingPrompt, setWaitingPrompt] = useState(false);

  useEffect(() => {
    if (!isOpen || isInstallable || isInstalled || isIOS || isInIframe) {
      setWaitingPrompt(false);
      return;
    }
    setWaitingPrompt(true);
    const timer = window.setTimeout(() => {
      recheckInstallability();
      setWaitingPrompt(false);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [isOpen, isInstallable, isInstalled, isIOS, isInIframe, recheckInstallability]);

  if (!isOpen) return null;

  const isInstalling = installStatus === 'installing';

  const handleInstallClick = async () => {
    if (!isInstallable || isInstalling) return;
    await install();
  };

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sas-store-title"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Store Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            {isDesktop ? (
              <Laptop className="w-4 h-4 text-emerald-600" />
            ) : (
              <Smartphone className="w-4 h-4 text-emerald-600" />
            )}
            <span>Instal Aplikasi SAS &amp; Pasang Ikon ({deviceLabel})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela instal aplikasi"
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* App Identity Header */}
          <div className="flex items-start gap-4">
            <SchoolLogo
              logoUrl={schoolLogo}
              schoolName={schoolName}
              className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center overflow-hidden shrink-0"
              imgClassName="w-full h-full object-contain p-1.5"
              fallbackIconClassName="w-9 h-9 text-emerald-700"
            />
            <div className="min-w-0 flex-1">
              <h2 id="sas-store-title" className="text-lg font-extrabold text-slate-900 leading-tight">
                SAS (Sistem Absensi Siswa)
              </h2>
              <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: accentColor }}>
                {schoolName}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  Ikon Resmi HP &amp; Desktop
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Android · iOS · Windows · Mac
                </span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 py-3 px-2 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
            <div className="px-2">
              <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-slate-900">
                <span>4.9</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Sekolah Resmi</p>
            </div>
            <div className="px-2">
              <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-slate-900">
                <HardDrive className="w-3.5 h-3.5 text-slate-700" />
                <span>~2 MB</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Ringan &amp; Cepat</p>
            </div>
            <div className="px-2">
              <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-slate-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Layar Utama</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Ikon Otomatis</p>
            </div>
          </div>

          {/* Primary Install Action */}
          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">
                    Berhasil! Aplikasi SAS Sudah Terinstal di {deviceLabel}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                    Ikon <strong>SAS Absensi</strong> kini sudah tampil di Layar Utama HP atau Desktop / Start Menu komputer Anda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{ backgroundColor: accentColor }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 cursor-pointer"
              >
                Lanjutkan Membuka Aplikasi SAS
              </button>
            </div>
          ) : isInstallable ? (
            <div className="space-y-2.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <p className="text-[11px] font-bold text-emerald-900 text-center">
                {autoOpened
                  ? `Installer siap! Klik tombol di bawah untuk memasang ikon SAS di ${deviceLabel}.`
                  : `Klik tombol di bawah untuk langsung menjalankan instalasi ke ${deviceLabel}.`}
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                style={{ backgroundColor: accentColor }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-sm font-extrabold text-white shadow-lg hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menginstal &amp; Membuat Ikon SAS...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>PASANG IKON APLIKASI SAS ({deviceLabel})</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-emerald-800/80 text-center">
                Konfirmasi sistem akan muncul — pilih <strong>Instal</strong> agar ikon langsung tampil di layar HP / Desktop.
              </p>
            </div>
          ) : waitingPrompt ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center text-center gap-2.5">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Menyiapkan Installer Otomatis ({deviceLabel})...
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {swReady
                    ? 'Memuat dialog pemasangan ikon SAS dari browser...'
                    : 'Mengaktifkan layanan offline & ikon aplikasi SAS...'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isInIframe && (
                <a
                  href={autoInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: accentColor }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-extrabold text-white shadow-md hover:opacity-95 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Tab Penuh &amp; Pasang Ikon SAS ({deviceLabel})</span>
                </a>
              )}

              {/* Guided Direct Native Icon Instructions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    {isDesktop ? (
                      <Laptop className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>
                      {isIOS
                        ? 'Pasang Ikon di iPhone / iPad (Safari)'
                        : isAndroid
                        ? `Pasang Ikon di HP Android (${browserName})`
                        : `Pasang Ikon ke Desktop PC (${browserName})`}
                    </span>
                  </p>
                  {!isIOS && !isInIframe && (
                    <button
                      type="button"
                      onClick={() => recheckInstallability()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Cek Ulang</span>
                    </button>
                  )}
                </div>

                {isIOS ? (
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                    <li>
                      Pastikan membuka SAS langsung di browser <strong>Safari</strong>.
                    </li>
                    <li className="flex items-start gap-1">
                      <span>Ketuk tombol</span>
                      <Share className="w-3.5 h-3.5 text-blue-600 inline shrink-0 mt-0.5" />
                      <span>
                        <strong>Bagikan (Share)</strong> di bar Safari.
                      </span>
                    </li>
                    <li>
                      Pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong> &rarr; ketuk{' '}
                      <strong>Tambah</strong>. Ikon SAS langsung muncul di layar iPhone/iPad.
                    </li>
                  </ol>
                ) : isAndroid ? (
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                    {isInIframe && (
                      <li>
                        Ketuk tombol hijau <strong>Buka Tab Penuh &amp; Pasang Ikon SAS</strong> di atas.
                      </li>
                    )}
                    <li>
                      Di {browserName} Android, ketuk menu{' '}
                      <MoreVertical className="w-3.5 h-3.5 inline text-slate-700" /> pojok kanan atas &rarr; pilih{' '}
                      <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
                    </li>
                    <li>
                      Konfirmasi <strong>Instal / Tambah</strong>. Ikon <strong>SAS Absensi</strong> otomatis tampil di layar utama HP Anda.
                    </li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                    {isInIframe && (
                      <li>
                        Klik tombol hijau <strong>Buka Tab Penuh &amp; Pasang Ikon SAS</strong> di atas.
                      </li>
                    )}
                    <li>
                      Di <strong>{browserName}</strong> komputer, klik ikon <strong>Instal SAS</strong> (ikon layar + panah) di ujung kanan kolom URL, atau klik menu{' '}
                      <strong>&#8942; &rarr; Simpan dan bagikan &rarr; Instal halaman sebagai aplikasi</strong>.
                    </li>
                    <li>
                      Klik <strong>Instal</strong>. Ikon <strong>SAS Absensi</strong> langsung tampil di Desktop &amp; Start Menu / Dock.
                    </li>
                  </ol>
                )}
              </div>

              {/* Optional HTML Launcher Fallback */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200">
                <div className="text-[11px] text-slate-600">
                  <p className="font-bold text-slate-800">Alternatif Pintasan Offline (.html)</p>
                  <p>Simpan file pintasan ke Desktop/File Manager jika browser memblokir menu instal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSasLauncherFile(schoolName)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Unduh Pintasan</span>
                </button>
              </div>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Keunggulan Aplikasi SAS Terinstal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                <ScanFace className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Scan Foto Wajah</p>
                  <p className="text-slate-500 mt-0.5">Kamera HP depan/belakang &amp; PC webcam.</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Notifikasi WhatsApp</p>
                  <p className="text-slate-500 mt-0.5">Kirim otomatis info kehadiran ke wali murid.</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Kartu &amp; Rapor PDF</p>
                  <p className="text-slate-500 mt-0.5">Cetak kartu portrait &amp; rapor kop surat resmi.</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Siap Offline (PWA)</p>
                  <p className="text-slate-500 mt-0.5">Ikon di layar utama HP &amp; Desktop PC.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AutoInstallOverlay: React.FC<{
  schoolName?: string;
  schoolLogo?: string;
  accentColor?: string;
}> = ({ schoolName, schoolLogo, accentColor = '#059669' }) => {
  const { autoInstallRequested, isInstalled, clearAutoInstallParam } = usePWAInstall();

  if (!autoInstallRequested || isInstalled) return null;

  return (
    <AppInstallStoreModal
      isOpen={true}
      onClose={clearAutoInstallParam}
      schoolName={schoolName}
      schoolLogo={schoolLogo}
      accentColor={accentColor}
      autoOpened={true}
    />
  );
};

export const InstallSuccessToast: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => {
      setVisible(true);
    };
    window.addEventListener('sas:pwa-installed', show);
    return () => window.removeEventListener('sas:pwa-installed', show);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 right-4 z-[90] max-w-sm rounded-2xl bg-emerald-700 text-white p-4 shadow-2xl border border-emerald-500 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0 mt-0.5" />
      <div className="text-xs flex-1">
        <p className="font-extrabold">Aplikasi SAS Berhasil Diinstal!</p>
        <p className="text-emerald-100 mt-0.5 leading-relaxed">
          Ikon <strong>SAS Absensi</strong> kini sudah tampil di Layar Utama HP atau Desktop PC Anda.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Tutup notifikasi instalasi"
        className="p-1 rounded-lg hover:bg-emerald-600/80 text-emerald-100 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'sidebar' | 'login' | 'settings';
  schoolName?: string;
  schoolLogo?: string;
  accentColor?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  schoolName,
  schoolLogo,
  accentColor = '#059669',
}) => {
  const {
    isInstallable,
    isInstalled,
    installStatus,
    isInIframe,
    autoInstallUrl,
    install,
  } = usePWAInstall();
  const [isStoreOpen, setIsStoreOpen] = useState(false);

  // Suppress ambient buttons when already running as an installed standalone app
  if (isInstalled && variant !== 'settings') {
    return null;
  }

  const isInstalling = installStatus === 'installing';

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setIsStoreOpen(true);
      }
      return;
    }
    setIsStoreOpen(true);
  };

  // Inside an iframe without beforeinstallprompt, render direct <a target="_blank"> link
  // to open the standalone installer tab in 1 click without using window.open.
  const shouldUseDirectTabLink = isInIframe && !isInstallable;

  if (variant === 'navbar') {
    return (
      <>
        {shouldUseDirectTabLink ? (
          <a
            href={autoInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Instal Aplikasi SAS & Pasang Ikon (HP / PC)"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Instal App</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={isInstalling}
            title="Instal Aplikasi SAS ke Layar HP / Desktop PC"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isInstalling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">
              {isInstalling ? 'Menginstal...' : 'Instal App'}
            </span>
          </button>
        )}

        <AppInstallStoreModal
          isOpen={isStoreOpen}
          onClose={() => setIsStoreOpen(false)}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          accentColor={accentColor}
        />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        {shouldUseDirectTabLink ? (
          <a
            href={autoInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Instal App SAS (HP / PC)</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={isInstalling}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menginstal Aplikasi...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Instal App SAS (HP / PC)</span>
              </>
            )}
          </button>
        )}

        <AppInstallStoreModal
          isOpen={isStoreOpen}
          onClose={() => setIsStoreOpen(false)}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          accentColor={accentColor}
        />
      </>
    );
  }

  if (variant === 'login') {
    return (
      <>
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ backgroundColor: accentColor + '18', color: accentColor }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                Instal Aplikasi SAS (HP &amp; PC)
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {isInstallable
                  ? '1-Klik langsung pasang ikon ke Android, iPhone, Windows & Mac'
                  : 'Pasang ikon SAS langsung di Layar HP & Desktop Komputer'}
              </p>
            </div>
          </div>
          {shouldUseDirectTabLink ? (
            <a
              href={autoInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-xl shadow-xs hover:opacity-95 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instal App</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClick}
              disabled={isInstalling}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-xl shadow-xs hover:opacity-95 shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isInstalling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isInstalling ? 'Menginstal...' : 'Instal App'}</span>
            </button>
          )}
        </div>

        <AppInstallStoreModal
          isOpen={isStoreOpen}
          onClose={() => setIsStoreOpen(false)}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          accentColor={accentColor}
        />
      </>
    );
  }

  // Settings full card variant
  return (
    <>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <SchoolLogo
              logoUrl={schoolLogo}
              schoolName={schoolName}
              className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
              imgClassName="w-full h-full object-contain p-1"
              fallbackIconClassName="w-7 h-7 text-emerald-700"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">
                  Instal Aplikasi SAS ke Layar HP &amp; Desktop PC
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {isInstallable ? 'Siap Pasang 1-Klik' : 'Android · iOS · Windows · Mac'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Klik tombol Instal untuk langsung menjalankan pemasangan aplikasi SAS sehingga ikon langsung tampil di Layar Utama HP maupun Desktop komputer.
              </p>
            </div>
          </div>

          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Sudah Terinstal
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {shouldUseDirectTabLink ? (
                <a
                  href={autoInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: accentColor }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Instal App SAS Sekarang</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={isInstalling}
                  style={{ backgroundColor: accentColor }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-60"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menjalankan Instalasi...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Instal App SAS Sekarang</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsStoreOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              >
                <span>Panduan Ikon HP/PC</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AppInstallStoreModal
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        accentColor={accentColor}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Mode Offline — Data tersimpan lokal tetap aktif</span>
    </div>
  );
};
