import React, { useMemo } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserX,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  Send,
  Phone,
  ScanFace,
  Calendar,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { AttendanceRecord, SchoolSettings, Student } from '../types/attendance';
import { createWhatsAppUrl, getStatusLabel } from '../utils/whatsapp';

interface AnalyticsDashboardProps {
  students: Student[];
  records: AttendanceRecord[];
  settings: SchoolSettings;
  onNavigateToTab: (tab: any) => void;
  onOpenQuickScan: () => void;
  onOpenWhatsAppBlast: (filter: 'absent' | 'late') => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  students,
  records,
  settings,
  onNavigateToTab,
  onOpenQuickScan,
  onOpenWhatsAppBlast,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter today's records
  const todayRecords = useMemo(
    () => records.filter((r) => r.date === todayStr),
    [records, todayStr]
  );

  // Today metrics
  const totalStudents = students.length;
  const hadirTepatCount = todayRecords.filter((r) => r.status === 'hadir_tepat').length;
  const terlambatCount = todayRecords.filter((r) => r.status === 'terlambat').length;
  const izinCount = todayRecords.filter((r) => r.status === 'izin').length;
  const sakitCount = todayRecords.filter((r) => r.status === 'sakit').length;
  const totalHadirFisik = hadirTepatCount + terlambatCount;
  const totalTercatat = hadirTepatCount + terlambatCount + izinCount + sakitCount;
  const belumAbsenCount = Math.max(0, totalStudents - totalTercatat);

  const attendanceRate = totalStudents > 0
    ? Math.round((totalHadirFisik / totalStudents) * 100)
    : 0;

  const waSentToday = todayRecords.filter((r) => r.whatsappNotification.sent).length;

  // Unchecked in students today
  const absentStudents = useMemo(() => {
    const presentIds = new Set(todayRecords.map((r) => r.studentId));
    return students.filter((s) => !presentIds.has(s.id));
  }, [students, todayRecords]);

  // Students needing attention (e.g., late >= 2 times or absent) across all records in last 14 days
  const studentsNeedingAttention = useMemo(() => {
    const countMap: { [key: string]: { late: number; alpa: number; student: Student } } = {};
    students.forEach((s) => {
      countMap[s.id] = { late: 0, alpa: 0, student: s };
    });

    records.forEach((r) => {
      if (countMap[r.studentId]) {
        if (r.status === 'terlambat') countMap[r.studentId].late += 1;
        if (r.status === 'alpa') countMap[r.studentId].alpa += 1;
      }
    });

    return Object.values(countMap)
      .filter((item) => item.late >= 2 || item.alpa >= 1)
      .sort((a, b) => b.late + b.alpa * 2 - (a.late + a.alpa * 2))
      .slice(0, 5);
  }, [students, records]);

  // Breakdown by class for today
  const classBreakdown = useMemo(() => {
    const classes = Array.from(new Set(students.map((s) => s.studentClass))).sort();
    return classes.map((className) => {
      const classStudents = students.filter((s) => s.studentClass === className);
      const classPresent = todayRecords.filter(
        (r) => r.studentClass === className && (r.status === 'hadir_tepat' || r.status === 'terlambat')
      ).length;
      const pct = classStudents.length > 0 ? Math.round((classPresent / classStudents.length) * 100) : 0;
      return {
        className,
        total: classStudents.length,
        present: classPresent,
        percentage: pct,
      };
    });
  }, [students, todayRecords]);

  // Past 7 Days Attendance Trend calculation
  const trendData = useMemo(() => {
    const days: { date: string; label: string; onTime: number; late: number; rate: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);

      const dayRecords = records.filter((r) => r.date === dStr);
      const onTime = dayRecords.filter((r) => r.status === 'hadir_tepat').length;
      const late = dayRecords.filter((r) => r.status === 'terlambat').length;
      const totalHadir = onTime + late;
      const rate = totalStudents > 0 ? Math.round((totalHadir / totalStudents) * 100) : 0;

      days.push({
        date: dStr,
        label: i === 0 ? 'Hari Ini' : dayName,
        onTime,
        late,
        rate,
      });
    }
    return days;
  }, [records, totalStudents]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Dasbor Analitik Presensi Real-Time
            </h1>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan kehadiran siswa dan status transmisi notifikasi WhatsApp ke wali murid
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToTab('schedule')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Jadwal & Sesi</span>
          </button>

          <button
            onClick={() => onNavigateToTab('progress')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Rapor Siswa</span>
          </button>

          {belumAbsenCount > 0 && (
            <button
              onClick={() => onOpenWhatsAppBlast('absent')}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Blast WA ({belumAbsenCount})</span>
            </button>
          )}

          <button
            onClick={onOpenQuickScan}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <ScanFace className="w-3.5 h-3.5" />
            <span>Scan Wajah</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid (Tabular Numerals) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Siswa */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Total Siswa</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalStudents}
            </span>
            <span className="text-[11px] text-slate-500">siswa</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Terdaftar di 4 kelas</span>
          </div>
        </div>

        {/* Tingkat Kehadiran */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Kehadiran Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {attendanceRate}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-medium">
            {totalHadirFisik} dari {totalStudents} hadir fisik
          </div>
        </div>

        {/* Tepat Waktu */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Tepat Waktu</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
              {hadirTepatCount}
            </span>
            <span className="text-[11px] text-slate-500">siswa</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Sebelum {settings.checkInLateTolerance} WIB
          </div>
        </div>

        {/* Terlambat */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Terlambat</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
              {terlambatCount}
            </span>
            <span className="text-[11px] text-slate-500">siswa</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-700">
            Perlu motivasi disiplin
          </div>
        </div>

        {/* Izin & Sakit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Izin / Sakit</span>
            <AlertTriangle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 font-mono tabular-nums">
              {izinCount + sakitCount}
            </span>
            <span className="text-[11px] text-slate-500">surat</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {sakitCount} Sakit · {izinCount} Izin
          </div>
        </div>

        {/* Belum Hadir / Alpa */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-500">Belum Absen</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 font-mono tabular-nums">
              {belumAbsenCount}
            </span>
            <span className="text-[11px] text-slate-500">siswa</span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700 font-medium">
            Siap di-blast via WA
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 7-Day Trend Chart & Class Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          {/* Trend Kehadiran 7 Hari Terakhir */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Tren Persentase Kehadiran 7 Hari Terakhir
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grafik tingkat kedatangan siswa tepat waktu vs keterlambatan
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-xs bg-emerald-500" />
                  <span className="text-slate-600">Tepat Waktu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-xs bg-amber-400" />
                  <span className="text-slate-600">Terlambat</span>
                </div>
              </div>
            </div>

            {/* Custom SVG Trend Bar & Line Visualization */}
            <div className="relative pt-6 pb-2">
              <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44">
                {trendData.map((d, idx) => {
                  const maxVal = totalStudents || 16;
                  const onTimeHeight = Math.round((d.onTime / maxVal) * 100);
                  const lateHeight = Math.round((d.late / maxVal) * 100);

                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-slate-900 text-white px-2 py-1 rounded absolute -top-4 pointer-events-none z-10 whitespace-nowrap shadow-md">
                        {d.label}: {d.onTime} Tepat, {d.late} Terlambat ({d.rate}%)
                      </div>

                      {/* Bar Stack */}
                      <div className="w-full max-w-[38px] bg-slate-100 rounded-lg overflow-hidden flex flex-col justify-end p-0.5 gap-0.5">
                        {d.late > 0 && (
                          <div
                            style={{ height: `${Math.max(8, lateHeight * 1.2)}px` }}
                            className="w-full bg-amber-400 rounded-t-sm transition-all duration-300"
                          />
                        )}
                        <div
                          style={{ height: `${Math.max(12, onTimeHeight * 1.2)}px` }}
                          className="w-full bg-emerald-500 rounded-b-sm transition-all duration-300"
                        />
                      </div>

                      {/* Percentage Badge */}
                      <span className="text-[11px] font-bold text-slate-700 font-mono tabular-nums mt-2">
                        {d.rate}%
                      </span>
                      {/* Day Label */}
                      <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Breakdown per Kelas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rekapitulasi Kehadiran per Rombel / Kelas Hari Ini
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Persentase tingkat kepatuhan absensi di tiap tingkatan kelas
                </p>
              </div>
              <button
                onClick={() => onNavigateToTab('reports')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Lihat Detail <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {classBreakdown.map((item) => (
                <div key={item.className} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{item.className}</span>
                    <span className="font-mono tabular-nums text-slate-600 font-medium">
                      {item.present} / {item.total} Siswa ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.percentage >= 80
                          ? 'bg-emerald-500'
                          : item.percentage >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: WhatsApp Integration & Students Needing Attention */}
        <div className="lg:col-span-4 space-y-6">
          {/* WhatsApp Status Box */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-semibold bg-emerald-500/50 uppercase tracking-wider px-2 py-0.5 rounded border border-white/20">
                Gateway Aktif
              </span>
            </div>

            <h3 className="text-base font-bold mt-3">Transmisi WhatsApp Real-Time</h3>
            <p className="text-xs text-emerald-100 mt-1">
              Setiap tap presensi otomatis mengirimkan laporan resmi ke nomor WhatsApp orang tua murid.
            </p>

            <div className="mt-4 pt-4 border-t border-emerald-500/40 grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="block text-2xl font-bold font-mono tabular-nums text-white">
                  {waSentToday}
                </span>
                <span className="text-[10px] text-emerald-100 uppercase tracking-wide">
                  Terkirim Hari Ini
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="block text-2xl font-bold font-mono tabular-nums text-white">
                  {belumAbsenCount}
                </span>
                <span className="text-[10px] text-emerald-100 uppercase tracking-wide">
                  Antrean Alpa
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('whatsapp')}
              className="mt-4 w-full py-2 bg-white text-emerald-800 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors shadow-xs"
            >
              Buka Pusat Notifikasi & Broadcast
            </button>
          </div>

          {/* Students Needing Attention Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Perhatian Khusus (BK)</h3>
              </div>
              <span className="text-[10px] text-slate-400">Kedisiplinan</span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Siswa dengan akumulasi keterlambatan atau ketidakhadiran berulang
            </p>

            <div className="space-y-2.5">
              {studentsNeedingAttention.length > 0 ? (
                studentsNeedingAttention.map(({ student, late, alpa }) => (
                  <div
                    key={student.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {student.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{student.studentClass}</span>
                        <span>·</span>
                        <span className="text-amber-700 font-medium">{late}x Terlambat</span>
                        {alpa > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-rose-600 font-medium">{alpa}x Alpa</span>
                          </>
                        )}
                      </div>
                    </div>

                    <a
                      href={createWhatsAppUrl(
                        student.parentPhone,
                        `Yth. Bapak/Ibu ${student.parentName}, wali dari ananda ${student.name} (${student.studentClass}). Kami dari pihak sekolah ${settings.schoolName} ingin mengonfirmasikan perihal kehadiran dan kedisiplinan ananda yang tercatat telah ${late} kali terlambat. Mohon kesediaannya untuk berkoordinasi dengan wali kelas/BK. Terima kasih.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg shrink-0 transition-colors"
                      title="Hubungi Orang Tua via WhatsApp"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Tidak ada catatan kedisiplinan kritis saat ini.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream of Today's Scans */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Aktivitas Presensi Terkini Hari Ini
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aliran data presensi foto wajah secara langsung dari gerbang sekolah
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('reports')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            Lihat Rekap Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium">
                  <th className="pb-2.5 font-medium">Waktu Tap</th>
                  <th className="pb-2.5 font-medium">Nama Siswa</th>
                  <th className="pb-2.5 font-medium">Kelas</th>
                  <th className="pb-2.5 font-medium">NIS</th>
                  <th className="pb-2.5 font-medium">Status Kehadiran</th>
                  <th className="pb-2.5 font-medium">Wali Murid</th>
                  <th className="pb-2.5 font-medium text-right">Notifikasi WA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayRecords.slice(-8).reverse().map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 font-mono tabular-nums text-slate-700">
                      {rec.checkInTime}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-900">{rec.studentName}</td>
                    <td className="py-2.5 text-slate-600">{rec.studentClass}</td>
                    <td className="py-2.5 font-mono text-slate-500">{rec.studentNis}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          rec.status === 'hadir_tepat'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'terlambat'
                            ? 'bg-amber-100 text-amber-800'
                            : rec.status === 'sakit'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {getStatusLabel(rec.status)}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600">{rec.parentName}</td>
                    <td className="py-2.5 text-right">
                      {rec.whatsappNotification.sent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 font-mono">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Terkirim
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada data presensi yang masuk hari ini.
          </div>
        )}
      </div>
    </div>
  );
};
