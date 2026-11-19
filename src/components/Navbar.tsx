import React, { useState } from 'react';
import {
  ScanFace,
  Clock,
  Palette,
  Check,
  LogOut,
  Menu,
} from 'lucide-react';
import { AuthUser, SchoolSettings } from '../types/attendance';
import { useTheme } from '../context/ThemeContext';
import { SchoolLogo } from './SchoolLogo';
import { PWAInstallButton } from './PWAInstallUI';

export type NavTab =
  | 'dashboard'
  | 'scanner'
  | 'schedule'
  | 'students'
  | 'progress'
  | 'reports'
  | 'whatsapp'
  | 'settings';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  settings: SchoolSettings;
  todayCount: number;
  totalStudents: number;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  todayCount,
  totalStudents,
  authUser,
  onLogout,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const [time, setTime] = useState<string>('');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const { activeTheme, setUserTheme, allThemes, userThemeId } = useTheme();

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
      {/* Top Banner Info */}
      <div className="bg-slate-900 text-slate-200 text-xs px-4 sm:px-6 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SchoolLogo
            logoUrl={settings.schoolLogo}
            schoolName={settings.schoolName}
            className="w-5 h-5 rounded-full bg-white border border-white/20 flex items-center justify-center overflow-hidden shrink-0"
            imgClassName="w-full h-full object-contain p-0.5"
            fallbackIconClassName="w-3 h-3 text-slate-700"
          />
          <span className="font-semibold text-white tracking-wide truncate">{settings.schoolName}</span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400 shrink-0">NPSN: {settings.npsn}</span>
          <span className="hidden md:inline text-slate-500">|</span>
          <span className="hidden md:inline text-slate-400 shrink-0">
            TA {settings.academicYear} ({settings.semester})
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-xs shrink-0">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            {time}
          </span>
          <span className="hidden sm:inline text-slate-600">·</span>
          <span className="hidden sm:inline text-emerald-400 font-medium">
            Kehadiran: {todayCount}/{totalStudents} Siswa
          </span>
          {authUser && (
            <>
              <span className="hidden md:inline text-slate-600">·</span>
              <span className="hidden md:inline font-sans text-slate-300">
                {authUser.displayName} ({authUser.role})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Nav Header */}
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left: Hamburger Toggle (Garis Tiga) + Brand Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
              title={isSidebarOpen ? 'Tutup Sidebar Menu' : 'Buka Sidebar Menu'}
              className={`flex items-center justify-center p-2 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                isSidebarOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <SchoolLogo
              logoUrl={settings.schoolLogo}
              schoolName={settings.schoolName}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs shrink-0"
              imgClassName="w-full h-full object-contain p-0.5"
              fallbackIconClassName="w-5 h-5 text-slate-700"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  SAS
                </span>
                <span
                  style={{ borderColor: activeTheme.previewColor + '40', color: activeTheme.previewColor }}
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded border bg-slate-50"
                >
                  {activeTheme.name.split(' ')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Sistem Absensi Siswa
              </p>
            </div>
          </div>

          {/* Right Actions: Theme Selector, Quick Face Scan, Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Selector Button & Popover */}
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Pilih Tema Warna Aplikasi"
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                  style={{ backgroundColor: activeTheme.previewColor }}
                />
                <span className="hidden sm:inline text-xs">{activeTheme.name.split(' ')[0]}</span>
                <Palette className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900">Pilih Tema Tampilan</span>
                    <span className="text-[10px] text-slate-400">Siswa & Guru</span>
                  </div>

                  <div className="space-y-1.5">
                    {allThemes.map((thm) => {
                      const isSelected = activeTheme.id === thm.id;
                      return (
                        <button
                          key={thm.id}
                          onClick={() => {
                            setUserTheme(thm.id);
                            setIsThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors ${
                            isSelected
                              ? 'bg-slate-100 font-bold text-slate-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-white shadow-2xs"
                              style={{ backgroundColor: thm.previewColor }}
                            />
                            <span>{thm.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>

                  {userThemeId && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-center">
                      <button
                        onClick={() => {
                          setUserTheme(settings.defaultThemeId || 'theme-emerald');
                          setIsThemeMenuOpen(false);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                      >
                        Kembalikan ke Default Sekolah
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Install App Button (PWA) */}
            <PWAInstallButton
              variant="navbar"
              schoolName={settings.schoolName}
              schoolLogo={settings.schoolLogo}
              accentColor={activeTheme.previewColor}
            />

            {/* Face Scanner Primary CTA */}
            <button
              onClick={() => onSelectTab('scanner')}
              style={{ backgroundColor: activeTheme.previewColor }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 hover:opacity-95 cursor-pointer ${
                currentTab === 'scanner' ? 'ring-2 ring-offset-2' : ''
              }`}
            >
              <ScanFace className="w-4 h-4" />
              <span className="hidden sm:inline">Scan Wajah</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Keluar dari akun"
                aria-label="Keluar dari akun"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
