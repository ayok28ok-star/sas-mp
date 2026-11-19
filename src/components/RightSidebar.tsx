import React from 'react';
import {
  LayoutDashboard,
  ScanFace,
  Users,
  ClipboardList,
  MessageSquare,
  Settings as SettingsIcon,
  Calendar,
  FileSpreadsheet,
  LogOut,
  X,
  UserCheck,
} from 'lucide-react';
import { AuthUser, SchoolSettings } from '../types/attendance';
import { useTheme } from '../context/ThemeContext';
import { NavTab } from './Navbar';
import { PWAInstallButton } from './PWAInstallUI';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  settings: SchoolSettings;
  todayCount: number;
  totalStudents: number;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  settings,
  todayCount,
  totalStudents,
  authUser,
  onLogout,
}) => {
  const { activeTheme } = useTheme();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dasbor Analitik', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'scanner', label: 'Scan Foto Wajah', icon: <ScanFace className="w-4 h-4" /> },
    { id: 'schedule', label: 'Jadwal & Kelas', icon: <Calendar className="w-4 h-4" /> },
    { id: 'students', label: 'Data Siswa & Kartu', icon: <Users className="w-4 h-4" /> },
    { id: 'progress', label: 'Rapor Siswa', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'reports', label: 'Rekap Absensi', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'whatsapp', label: 'Laporan WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop overlay for mobile / tablet drawer */}
      {isOpen && (
        <div
          onClick={onClose}
          className="no-print fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Container */}
      <aside
        aria-label="Sidebar Navigasi Kiri"
        className={`no-print bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 ease-in-out z-50
          fixed top-0 left-0 h-full shadow-2xl
          lg:sticky lg:top-[104px] lg:h-[calc(100vh-104px)] lg:shadow-none
          ${
            isOpen
              ? 'w-72 translate-x-0 opacity-100'
              : 'w-72 -translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0 lg:overflow-hidden lg:opacity-0 pointer-events-none'
          }
        `}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Sidebar Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs font-bold text-slate-900 tracking-tight">Menu Navigasi SAS</p>
              <p className="text-[11px] text-slate-500">
                Hadir Hari Ini: {todayCount}/{totalStudents}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup sidebar"
              title="Tutup sidebar"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active User Card */}
          {authUser && (
            <div className="mx-3 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 shrink-0">
              <div
                style={{ backgroundColor: activeTheme.previewColor }}
                className="w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0"
              >
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {authUser.displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{authUser.role}</p>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  style={active ? { backgroundColor: activeTheme.previewColor } : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                    active
                      ? 'text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 space-y-2 shrink-0 bg-slate-50/70">
          <div className="px-2 py-1 text-[11px] text-slate-500 truncate">
            {settings.schoolName}
          </div>
          <PWAInstallButton
            variant="sidebar"
            schoolName={settings.schoolName}
            schoolLogo={settings.schoolLogo}
            accentColor={activeTheme.previewColor}
          />
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
