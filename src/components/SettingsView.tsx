import React, { useEffect, useState } from 'react';
import {
  Clock,
  MessageSquare,
  Save,
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  Check,
  Building,
  Palette,
  ImagePlus,
  Trash2,
  FileSpreadsheet,
  Copy,
  FileCode2,
  Cloud,
  RefreshCw,
  ArrowUpFromLine,
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Share2,
  Unlink,
} from 'lucide-react';
import { SchoolSettings } from '../types/attendance';
import { StorageService } from '../services/storage';
import { SheetsSyncService, SheetsSyncStatus } from '../services/sheetsSync';
import { DEFAULT_SCHOOL_LOGO } from '../data/initialData';
import { availableThemes } from '../data/scheduleData';
import { SchoolLogo } from './SchoolLogo';
import { PWAInstallButton } from './PWAInstallUI';
import codeGsRaw from '../../google-apps-script/Code.gs?raw';
import gasIndexHtmlRaw from '../../google-apps-script/Index.html?raw';

interface SettingsViewProps {
  settings: SchoolSettings;
  onSaveSettings: (settings: SchoolSettings) => void;
  onResetData: () => void | Promise<void>;
  onSyncSheetsNow?: () => Promise<boolean>;
  onPushLocalToSheets?: () => Promise<boolean>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetData,
  onSyncSheetsNow,
  onPushLocalToSheets,
}) => {
  const [formData, setFormData] = useState<SchoolSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<'code' | 'index' | 'sharelink' | null>(null);

  const [syncStatus, setSyncStatus] = useState<SheetsSyncStatus>(() => SheetsSyncService.getStatus());
  const [gasUrlInput, setGasUrlInput] = useState<string>(() => SheetsSyncService.getGasApiUrl());
  const [gasTokenInput, setGasTokenInput] = useState<string>(() => SheetsSyncService.getSyncToken());
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  useEffect(() => {
    const unsub = SheetsSyncService.subscribe(() => {
      setSyncStatus(SheetsSyncService.getStatus());
    });
    return unsub;
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Format berkas harus berupa gambar (PNG, JPG, WebP, atau SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      if (file.type === 'image/svg+xml') {
        if (dataUrl.length > 200_000) {
          setLogoError('Ukuran SVG terlalu besar. Gunakan PNG/JPG atau SVG di bawah 150 KB.');
          return;
        }
        setFormData((prev) => ({ ...prev, schoolLogo: dataUrl }));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFormData((prev) => ({ ...prev, schoolLogo: dataUrl }));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/png', 0.9);
        setFormData((prev) => ({ ...prev, schoolLogo: compressed }));
      };
      img.onerror = () => {
        setLogoError('Gambar tidak dapat dibaca. Silakan pilih berkas logo lain.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    const jsonStr = StorageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_absensi_sekolah_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = StorageService.importData(content);
        if (ok) {
          if (SheetsSyncService.isConfigured() && onPushLocalToSheets) {
            setImportStatus('Data berhasil diimpor & sedang dikirim ke Google Spreadsheet...');
            await onPushLocalToSheets();
          } else {
            setImportStatus('Data berhasil diimpor! Halaman akan dimuat ulang...');
          }
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setImportStatus('Gagal membaca berkas JSON. Format tidak valid.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleTestAndConnectSheets = async () => {
    setSyncFeedback(null);
    const trimmedUrl = gasUrlInput.trim();
    if (!trimmedUrl) {
      setSyncFeedback({ type: 'error', text: 'Tempel URL Web App Google Apps Script (.../exec) terlebih dahulu.' });
      return;
    }
    const res = await SheetsSyncService.testConnection(trimmedUrl, gasTokenInput.trim());
    if (!res.ok) {
      setSyncFeedback({ type: 'error', text: res.error || 'Gagal menghubungkan ke Google Spreadsheet.' });
      return;
    }
    SheetsSyncService.setGasApiUrl(trimmedUrl);
    SheetsSyncService.setSyncToken(gasTokenInput.trim());
    setSyncFeedback({
      type: 'success',
      text: 'Terhubung ke Google Spreadsheet! Pilih "Kirim Data Lokal ke Sheet" (jika sudah ada data siswa di browser ini) atau "Tarik Data dari Sheet".',
    });
  };

  const handlePushLocalToSheetsClick = async () => {
    if (!onPushLocalToSheets) return;
    setSyncFeedback(null);
    const ok = await onPushLocalToSheets();
    if (ok) {
      setSyncFeedback({
        type: 'success',
        text: 'Seluruh data lokal (siswa, foto wajah, absensi, jadwal, pengaturan) berhasil dikunci ke Google Spreadsheet!',
      });
    } else {
      setSyncFeedback({
        type: 'error',
        text: SheetsSyncService.getStatus().lastError || 'Gagal mengirim data ke Google Spreadsheet.',
      });
    }
  };

  const handlePullFromSheetsClick = async () => {
    if (!onSyncSheetsNow) return;
    setSyncFeedback(null);
    const ok = await onSyncSheetsNow();
    if (ok) {
      setSyncFeedback({
        type: 'success',
        text: 'Data terbaru berhasil ditarik & disinkronkan dari Google Spreadsheet!',
      });
    } else {
      setSyncFeedback({
        type: 'error',
        text: SheetsSyncService.getStatus().lastError || 'Gagal menarik data dari Google Spreadsheet.',
      });
    }
  };

  const handleDisconnectSheets = () => {
    SheetsSyncService.setGasApiUrl('');
    SheetsSyncService.setSyncToken('');
    setGasUrlInput('');
    setGasTokenInput('');
    setSyncFeedback({ type: 'success', text: 'Koneksi URL lokal diputus. Aplikasi kembali ke mode lokal browser.' });
  };

  const handleCopyShareSyncLink = async () => {
    const activeUrl = gasUrlInput.trim() || syncStatus.apiUrl;
    if (!activeUrl) return;
    try {
      const shareUrl = new URL(window.location.origin + window.location.pathname);
      shareUrl.searchParams.set('gas_url', activeUrl);
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopiedFile('sharelink');
      setTimeout(() => setCopiedFile(null), 2400);
    } catch {
      setSyncFeedback({ type: 'error', text: 'Gagal menyalin link otomatis ke clipboard.' });
    }
  };

  const handleDownloadGasFile = (filename: string, content: string) => {
    const mimeType = filename.endsWith('.html') ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyGasFile = async (type: 'code' | 'index', content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(type);
      setTimeout(() => setCopiedFile(null), 2200);
    } catch {
      handleDownloadGasFile(type === 'code' ? 'Code.gs' : 'Index.html', content);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Pengaturan Sekolah & Integrasi Presensi
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Konfigurasi profil instansi, aturan jam toleransi keterlambatan, dan parameter gateway WhatsApp
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Profil Sekolah */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Profil Instansi Sekolah</h2>
          </div>

          {/* Logo Sekolah Tersimpan */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-4">
            <SchoolLogo
              logoUrl={formData.schoolLogo}
              schoolName={formData.schoolName}
              className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs"
              imgClassName="w-full h-full object-contain p-1.5"
              fallbackIconClassName="w-8 h-8 text-slate-400"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Logo Sekolah Resmi (Tersimpan di Profil Sekolah)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ditampilkan otomatis pada Favicon Tab Browser, halaman Login, Header SAS, Kartu Pelajar Portrait, dan Kop Surat Laporan Resmi.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Unggah Logo Baru</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setLogoError(null);
                    setFormData((prev) => ({ ...prev, schoolLogo: DEFAULT_SCHOOL_LOGO }));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Gunakan Logo Default</span>
                </button>

                {formData.schoolLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoError(null);
                      setFormData((prev) => ({ ...prev, schoolLogo: '' }));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Logo</span>
                  </button>
                )}
              </div>
              {logoError && (
                <p className="text-[11px] font-medium text-rose-600">{logoError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Resmi Sekolah</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">NPSN (Nomor Pokok Sekolah)</label>
              <input
                type="text"
                value={formData.npsn}
                onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                value={formData.principalName}
                onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                value={formData.principalNip}
                onChange={(e) => setFormData({ ...formData, principalNip: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tahun Ajaran</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value as 'Ganjil' | 'Genap' })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Aturan Jam Masuk & Toleransi */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">Jam Operasional & Batas Toleransi Kedatangan</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Mulai Buka Gerbang</label>
              <input
                type="time"
                value={formData.checkInStartTime}
                onChange={(e) => setFormData({ ...formData, checkInStartTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Waktu paling awal tap scanner</span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Batas Tepat Waktu</label>
              <input
                type="time"
                value={formData.checkInDeadline}
                onChange={(e) => setFormData({ ...formData, checkInDeadline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Bel masuk sekolah berbunyi</span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Batas Akhir Toleransi (Late Cutoff)</label>
              <input
                type="time"
                value={formData.checkInLateTolerance}
                onChange={(e) => setFormData({ ...formData, checkInLateTolerance: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm text-amber-700 font-bold"
              />
              <span className="text-[10px] text-amber-600 mt-1 block">Lewat jam ini = Status Terlambat</span>
            </div>
          </div>
        </div>

        {/* Section 3: Pengaturan WhatsApp Gateway */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Integrasi WhatsApp Notification Gateway</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">
                  Otomatis Kirim Pesan saat Scan Foto Wajah
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Sistem langsung men-generate laporan kehadiran instan ke WhatsApp wali murid saat wajah siswa dipindai
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoSendWhatsApp}
                  onChange={(e) => setFormData({ ...formData, autoSendWhatsApp: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Akun Bot WhatsApp Sekolah
                </label>
                <input
                  type="text"
                  value={formData.botSenderName}
                  onChange={(e) => setFormData({ ...formData, botSenderName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Telepon Kontak Resmi Sekolah
                </label>
                <input
                  type="text"
                  value={formData.schoolContactPhone}
                  onChange={(e) => setFormData({ ...formData, schoolContactPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Kustomisasi Skema Warna Default Aplikasi (Administrator) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Palette className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Skema Warna Default Sekolah (Administrator)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tentukan tema warna standar identitas instansi sekolah. Setiap siswa dan guru tetap dapat memilih tema personal tanpa mengganggu fungsionalitas inti.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {availableThemes.map((thm) => {
              const isDefault = (formData.defaultThemeId || 'theme-emerald') === thm.id;
              return (
                <div
                  key={thm.id}
                  onClick={() => setFormData({ ...formData, defaultThemeId: thm.id })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isDefault
                      ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2 bg-slate-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full border border-white shadow-2xs shrink-0"
                        style={{ backgroundColor: thm.previewColor }}
                      />
                      <span className="font-bold text-xs text-slate-900">{thm.name}</span>
                    </div>
                    {isDefault && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                    {thm.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
          {saveSuccess ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              {syncStatus.isConfigured
                ? 'Pengaturan disimpan ke browser & Google Spreadsheet!'
                : 'Pengaturan berhasil disimpan!'}
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              {syncStatus.isConfigured
                ? 'Tersinkron otomatis ke Google Spreadsheet + cache lokal browser.'
                : 'Konfigurasi tersimpan di penyimpanan lokal browser (localStorage).'}
            </span>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Section 4: Unduh & Instal Aplikasi (PWA Play Store Style) */}
      <PWAInstallButton
        variant="settings"
        schoolName={formData.schoolName}
        schoolLogo={formData.schoolLogo}
      />

      {/* Section 5: Backup, Restore & Reset */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldAlert className="w-5 h-5 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">Pencadangan, Pemulihan & Reset Data</h2>
        </div>

        <p className="text-xs text-slate-500">
          Amankan seluruh data siswa, log absensi, pengaturan, dan template pesan WhatsApp dalam satu berkas cadangan JSON.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Cadangan Lengkap (JSON)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Pulihkan dari File JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  'Apakah Anda yakin ingin mengosongkan seluruh data siswa, kelas, guru, jadwal, dan riwayat absensi?'
                )
              ) {
                onResetData();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg ml-auto transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Kosongkan Semua Data</span>
          </button>
        </div>

        {importStatus && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            {importStatus}
          </div>
        )}
      </div>

      {/* Section 5: Integrasi Otomatis Vercel <-> Google Spreadsheet */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Integrasi Otomatis Vercel &harr; Google Spreadsheet
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hubungkan URL Web App <code className="font-mono text-slate-700">Code.gs</code> agar seluruh data siswa, foto wajah, absensi, dan pengaturan otomatis masuk ke Google Sheets dan tidak pernah hilang/reset.
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shrink-0 ${
              syncStatus.isConfigured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {syncStatus.isConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terhubung Otomatis</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-amber-600" />
                <span>Mode Lokal (Belum Terhubung Sheet)</span>
              </>
            )}
          </span>
        </div>

        {/* Live Sync Configuration Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                URL Web App Google Apps Script (<span className="font-mono font-normal">.../exec</span>)
              </label>
              <input
                type="url"
                value={gasUrlInput}
                onChange={(e) => setGasUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px] text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Token Keamanan (Opsional)
              </label>
              <input
                type="password"
                value={gasTokenInput}
                onChange={(e) => setGasTokenInput(e.target.value)}
                placeholder="Kosongkan jika tanpa token"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px] text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestAndConnectSheets}
              disabled={syncStatus.isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span>Simpan &amp; Tes Koneksi Sheet</span>
            </button>

            {syncStatus.isConfigured && (
              <>
                <button
                  type="button"
                  onClick={handlePushLocalToSheetsClick}
                  disabled={syncStatus.isSyncing}
                  title="Unggah semua data di browser ini ke Google Spreadsheet agar tidak hilang"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>Kirim Data Lokal ke Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSheetsClick}
                  disabled={syncStatus.isSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tarik Data Terbaru dari Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyShareSyncLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {copiedFile === 'sharelink' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Link Perangkat Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Salin Link untuk HP Lain</span>
                    </>
                  )}
                </button>

                {syncStatus.source === 'local' && (
                  <button
                    type="button"
                    onClick={handleDisconnectSheets}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-rose-700 hover:bg-rose-50 rounded-xl font-medium ml-auto cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Putuskan</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Live Sync Metadata */}
          {syncStatus.isConfigured && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Sumber URL:{' '}
                  <strong className="text-slate-900">
                    {syncStatus.source === 'env' ? 'Vercel Environment (VITE_GAS_API_URL)' : 'Tersimpan di Perangkat'}
                  </strong>
                </span>
                {syncStatus.lastSyncAt && (
                  <span>
                    Sinkron Terakhir:{' '}
                    <strong className="text-slate-900">
                      {new Date(syncStatus.lastSyncAt).toLocaleTimeString('id-ID')} WIB
                    </strong>
                  </span>
                )}
                {syncStatus.pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    {syncStatus.pendingCount} antrean offline menunggu dikirim
                  </span>
                )}
              </div>
              {syncStatus.spreadsheetUrl && (
                <a
                  href={syncStatus.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Google Spreadsheet</span>
                </a>
              )}
            </div>
          )}

          {syncFeedback && (
            <div
              className={`p-3 rounded-xl border text-[11px] font-medium flex items-start gap-2 ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{syncFeedback.text}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900 font-mono">Code.gs</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Backend Apps Script
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Membuat 10 sheet otomatis (<span className="font-medium">Siswa, Absensi, Kelas, Mapel, Guru, Jadwal, Pengaturan, TemplateWA, LogNotifikasi, Pengguna</span>), menyinkronkan Favicon Apps Script (<code className="font-mono">setFaviconUrl</code> + Drive), dan menyediakan endpoint Web App &amp; Manifest.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownloadGasFile('Code.gs', codeGsRaw)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Code.gs</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyGasFile('code', codeGsRaw)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                {copiedFile === 'code' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900 font-mono">Index.html</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Frontend HtmlService
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Antarmuka lengkap SAS (Login &amp; Daftar Pengguna, Sidebar Kiri, Jam Digital, Logo &amp; Favicon Apps Script Otomatis, Tombol Unduh Aplikasi, Scan Foto Wajah HP, Jadwal, Kartu Portrait, Rapor PDF, Blast WA) terhubung via <code className="font-mono">google.script.run</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownloadGasFile('Index.html', gasIndexHtmlRaw)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Index.html</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyGasFile('index', gasIndexHtmlRaw)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                {copiedFile === 'index' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5 text-emerald-950">
          <p className="font-bold">Langkah Hubungkan Vercel &harr; Google Spreadsheet (Agar Data Permanen):</p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-900 leading-relaxed">
            <li>Buka Google Spreadsheet baru (<span className="font-mono">sheets.new</span>), klik menu <strong>Ekstensi &rarr; Apps Script</strong>.</li>
            <li>Tempel seluruh isi <strong>Code.gs</strong> terbaru di atas ke file <code className="font-mono">Code.gs</code>, lalu buat file HTML bernama <code className="font-mono font-bold">Index</code> dan tempel isi <strong>Index.html</strong>.</li>
            <li>Simpan (<kbd className="px-1 py-0.5 bg-white border border-emerald-200 rounded text-[10px]">Ctrl+S</kbd>), jalankan fungsi <code className="font-mono">initializeDatabase</code> sekali untuk membuat 10 sheet &amp; memberi izin akses.</li>
            <li>Klik <strong>Deploy &rarr; New deployment &rarr; Web app</strong> (Execute as: <em>Me</em>, Who has access: <strong>Anyone</strong>), lalu salin URL <code className="font-mono">https://script.google.com/macros/s/.../exec</code>.</li>
            <li>Tempel URL tersebut di kolom <strong>URL Web App Google Apps Script</strong> di atas (lalu klik <strong>Simpan &amp; Tes Koneksi Sheet</strong> &rarr; <strong>Kirim Data Lokal ke Sheet</strong>), <strong>atau</strong> tambahkan sebagai Environment Variable <code className="font-mono font-bold">VITE_GAS_API_URL</code> di <strong>Vercel &rarr; Settings &rarr; Environment Variables</strong> lalu redeploy agar semua perangkat otomatis terhubung permanen.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
