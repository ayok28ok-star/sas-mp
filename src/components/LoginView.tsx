import React, { useEffect, useState } from 'react';
import {
  Clock,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  User,
  AlertCircle,
  Calendar,
  UserPlus,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { AuthUser, RegisteredUser, SchoolSettings, Student } from '../types/attendance';
import { useTheme } from '../context/ThemeContext';
import { SchoolLogo } from './SchoolLogo';
import { StorageService } from '../services/storage';
import { PWAInstallButton } from './PWAInstallUI';

interface LoginViewProps {
  settings: SchoolSettings;
  students: Student[];
  registeredUsers?: RegisteredUser[];
  onRegisterUser?: (user: RegisteredUser) => void;
  onLoginSuccess: (user: AuthUser) => void;
}

const DEFAULT_STAFF_ACCOUNTS: {
  username: string;
  password: string;
  displayName: string;
  role: AuthUser['role'];
}[] = [
  {
    username: 'admin',
    password: '123',
    displayName: 'Administrator Sekolah',
    role: 'Administrator',
  },
  {
    username: 'guru',
    password: '123',
    displayName: 'Siti Rahmawati, S.Pd.',
    role: 'Guru Piket',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  settings,
  students,
  registeredUsers: externalRegisteredUsers,
  onRegisterUser,
  onLoginSuccess,
}) => {
  const { activeTheme } = useTheme();
  const [now, setNow] = useState<Date>(() => new Date());
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regRole, setRegRole] = useState<RegisteredUser['role']>('Guru Piket');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() =>
    externalRegisteredUsers ?? StorageService.getRegisteredUsers()
  );
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (externalRegisteredUsers) {
      setRegisteredUsers(externalRegisteredUsers);
    }
  }, [externalRegisteredUsers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Mohon masukkan username dan password terlebih dahulu.');
      return;
    }

    // 1. Check newly registered users
    const matchedRegistered = registeredUsers.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );
    if (matchedRegistered) {
      onLoginSuccess({
        username: matchedRegistered.username,
        displayName: matchedRegistered.displayName,
        role: matchedRegistered.role,
      });
      return;
    }

    // 2. Check built-in staff/admin accounts
    const matchedStaff = DEFAULT_STAFF_ACCOUNTS.find(
      (acc) =>
        acc.username === cleanUser &&
        (cleanPass === acc.password || cleanPass === `${acc.username}123`)
    );
    if (matchedStaff) {
      onLoginSuccess({
        username: matchedStaff.username,
        displayName: matchedStaff.displayName,
        role: matchedStaff.role,
      });
      return;
    }

    // 3. Check student NIS login
    const matchedStudent = students.find((s) => s.nis.toLowerCase() === cleanUser);
    if (
      matchedStudent &&
      (cleanPass === '123' || cleanPass === 'siswa123' || cleanPass === matchedStudent.nis)
    ) {
      onLoginSuccess({
        username: matchedStudent.nis,
        displayName: matchedStudent.name,
        role: 'Siswa',
      });
      return;
    }

    setError('Username atau password tidak sesuai. Silakan periksa kembali.');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = regDisplayName.trim();
    const cleanUser = regUsername.trim().toLowerCase();
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();

    if (!cleanName || !cleanUser || !cleanPass || !cleanConfirm) {
      setError('Mohon lengkapi seluruh kolom pendaftaran pengguna baru.');
      return;
    }

    if (cleanUser.length < 3 || /\s/.test(cleanUser)) {
      setError('Username minimal 3 karakter dan tidak boleh mengandung spasi.');
      return;
    }

    if (cleanPass.length < 4) {
      setError('Password minimal 4 karakter demi keamanan akun.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
      return;
    }

    const existsInStaff = DEFAULT_STAFF_ACCOUNTS.some((a) => a.username === cleanUser);
    const existsInRegistered = registeredUsers.some(
      (u) => u.username.toLowerCase() === cleanUser
    );

    if (existsInStaff || existsInRegistered) {
      setError(`Username "${cleanUser}" sudah terdaftar. Gunakan username lain.`);
      return;
    }

    const newUser: RegisteredUser = {
      id: `usr-${Date.now()}`,
      username: cleanUser,
      password: cleanPass,
      displayName: cleanName,
      role: regRole,
      createdAt: new Date().toISOString(),
    };

    if (onRegisterUser) {
      onRegisterUser(newUser);
      setRegisteredUsers((prev) => [newUser, ...prev]);
    } else {
      const updatedList = StorageService.addRegisteredUser(newUser);
      setRegisteredUsers(updatedList);
    }

    // Clear username & password on login form after successful registration
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setRegDisplayName('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setAuthMode('login');
    setSuccessMsg(
      `Pengguna "${cleanName}" (${regRole}) berhasil didaftarkan! Silakan masukkan username dan password Anda untuk masuk.`
    );
  };

  const switchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[430px] space-y-4">
        {/* Jam Digital tepat di atas tampilan login dengan ukuran lebar yang proporsional/sejajar */}
        <div className="w-full bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg px-6 py-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {formattedDate}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Batas Masuk: {settings.checkInLateTolerance}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-wider text-white">
                {formattedTime}
              </span>
              <span
                style={{ color: activeTheme.previewColor }}
                className="text-xs font-bold font-mono tracking-widest"
              >
                WIB
              </span>
            </div>

            <div
              className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Clock className="w-5 h-5" style={{ color: activeTheme.previewColor }} />
            </div>
          </div>
        </div>

        {/* Kartu Login & Daftar Pengguna Baru */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7">
          {/* Header Identitas Sekolah */}
          <div className="flex items-center gap-3.5 sm:gap-4 pb-5 border-b border-slate-100">
            <SchoolLogo
              logoUrl={settings.schoolLogo}
              schoolName={settings.schoolName}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs shrink-0"
              imgClassName="w-full h-full object-contain p-1"
              fallbackIconClassName="w-8 h-8 text-slate-700"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                SAS (Sistem Absensi Siswa)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate mt-0.5">
                {settings.schoolName}
              </p>
            </div>
          </div>

          {/* Tab Masuk vs Daftar Pengguna Baru */}
          <div className="mt-5 p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Daftar Pengguna Baru</span>
            </button>
          </div>

          <div className="mt-4 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {authMode === 'login' ? 'Masuk ke Portal Presensi' : 'Registrasi Pengguna Baru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {authMode === 'login'
                ? 'Masukkan username atau NIS dan password akun Anda.'
                : 'Buat akun baru untuk Administrator, Guru Piket, atau Siswa.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form key="login-form" onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Field Username */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Username / NIS
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username atau NIS"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Field Password dengan Icon Mata */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{ backgroundColor: activeTheme.previewColor }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white rounded-xl shadow-xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk</span>
              </button>

              <p className="text-center text-xs text-slate-500 pt-1">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-semibold text-slate-900 hover:underline cursor-pointer"
                >
                  Daftar Pengguna Baru
                </button>
              </p>
            </form>
          ) : (
            <form key="register-form" onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="reg-displayname"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap
                </label>
                <input
                  id="reg-displayname"
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="reg-username"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Username / NIS
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Tanpa spasi (min. 3 huruf)"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-role"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Peran Pengguna
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) =>
                        setRegRole(e.target.value as RegisteredUser['role'])
                      }
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    >
                      <option value="Guru Piket">Guru Piket</option>
                      <option value="Administrator">Administrator</option>
                      <option value="Siswa">Siswa</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full pl-10 pr-11 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-slate-800"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reg-confirm-password"
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="w-full pl-10 pr-11 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                    aria-label={
                      showRegConfirmPassword
                        ? 'Sembunyikan konfirmasi password'
                        : 'Lihat konfirmasi password'
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-slate-800"
                  >
                    {showRegConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{ backgroundColor: activeTheme.previewColor }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white rounded-xl shadow-xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Simpan & Daftarkan Pengguna</span>
              </button>

              <p className="text-center text-xs text-slate-500 pt-1">
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-slate-900 hover:underline cursor-pointer"
                >
                  Kembali ke Halaman Masuk
                </button>
              </p>
            </form>
          )}
        </div>

        <PWAInstallButton
          variant="login"
          schoolName={settings.schoolName}
          schoolLogo={settings.schoolLogo}
          accentColor={activeTheme.previewColor}
        />
      </div>
    </div>
  );
};
