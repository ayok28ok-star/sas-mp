import React, { useMemo, useState } from 'react';
import {
  Calendar,
  User,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserX,
  FileText,
  Phone,
  Send,
  Sparkles,
  School,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import {
  AttendanceRecord,
  SchoolSettings,
  Student,
} from '../types/attendance';
import { SchoolLogo } from './SchoolLogo';
import {
  createWhatsAppUrl,
  formatIndonesianDate,
  getStatusLabel,
} from '../utils/whatsapp';

interface StudentProgressReportProps {
  students: Student[];
  records: AttendanceRecord[];
  settings: SchoolSettings;
  selectedStudentId?: string;
  onDeleteStudentRecords?: (studentId: string) => void;
}

export const StudentProgressReport: React.FC<StudentProgressReportProps> = ({
  students,
  records,
  settings,
  selectedStudentId,
  onDeleteStudentRecords,
}) => {
  const [currentStudentId, setCurrentStudentId] = useState<string>(
    selectedStudentId || students[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  // Date range filter
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  // Default start date is 30 days ago
  const defaultStartDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, [today]);

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Quick Date Range Presets
  const setDatePreset = (preset: '7days' | '30days' | 'this_month' | 'semester') => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    setEndDate(endStr);

    if (preset === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
    } else if (preset === 'semester') {
      // Semester Ganjil starts around July 1st
      const start = new Date(now.getFullYear(), 6, 1);
      setStartDate(start.toISOString().split('T')[0]);
    }
  };

  const selectedStudent =
    students.find((s) => s.id === currentStudentId) || students[0];

  const uniqueClasses = Array.from(new Set(students.map((s) => s.studentClass))).sort();

  const filteredStudentList = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nis.includes(searchQuery);
    const matchClass = classFilter === 'all' || s.studentClass === classFilter;
    return matchSearch && matchClass;
  });

  const allSelectedStudentRecordsCount = useMemo(() => {
    if (!selectedStudent) return 0;
    return records.filter((r) => r.studentId === selectedStudent.id).length;
  }, [records, selectedStudent]);

  // Filter records for the selected student within date range
  const studentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    return records
      .filter((r) => {
        const matchesStudent = r.studentId === selectedStudent.id;
        const matchesDate = r.date >= startDate && r.date <= endDate;
        return matchesStudent && matchesDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, selectedStudent, startDate, endDate]);

  // Aggregate metrics
  const totalDays = studentRecords.length;
  const tepatCount = studentRecords.filter((r) => r.status === 'hadir_tepat').length;
  const terlambatCount = studentRecords.filter((r) => r.status === 'terlambat').length;
  const sakitCount = studentRecords.filter((r) => r.status === 'sakit').length;
  const izinCount = studentRecords.filter((r) => r.status === 'izin').length;
  const alpaCount = studentRecords.filter((r) => r.status === 'alpa').length;

  const totalHadirFisik = tepatCount + terlambatCount;
  const attendanceRate = totalDays > 0 ? Math.round((totalHadirFisik / totalDays) * 100) : 100;

  // Approximate late minutes
  const totalLateMinutes = useMemo(() => {
    let minutes = 0;
    studentRecords.forEach((r) => {
      if (r.status === 'terlambat' && r.checkInTime && r.checkInTime !== '-') {
        const [h, m] = r.checkInTime.split(':').map(Number);
        const checkInMin = h * 60 + m;
        const [deadH, deadM] = (settings.checkInLateTolerance || '07:15').split(':').map(Number);
        const deadMin = deadH * 60 + deadM;
        if (checkInMin > deadMin) {
          minutes += checkInMin - deadMin;
        } else {
          minutes += 15; // default estimation
        }
      }
    });
    return minutes;
  }, [studentRecords, settings.checkInLateTolerance]);

  // Qualification status
  const qualification = useMemo(() => {
    if (attendanceRate >= 85) {
      return {
        label: 'Sangat Baik (Memenuhi Syarat Evaluasi & Raport)',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800',
      };
    } else if (attendanceRate >= 75) {
      return {
        label: 'Waspada (Perlu Pembinaan Kedisiplinan)',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        badge: 'bg-amber-100 text-amber-800',
      };
    } else {
      return {
        label: 'Kritis (Di Bawah Batas Minimal Kehadiran 75%)',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        badge: 'bg-rose-100 text-rose-800',
      };
    }
  }, [attendanceRate]);

  // Generate WhatsApp progress message for parent
  const generateWhatsAppReport = () => {
    if (!selectedStudent) return '';
    return `*LAPORAN PERKEMBANGAN KEHADIRAN SISWA*
${settings.schoolName}
----------------------------------------
Yth. Bapak/Ibu ${selectedStudent.parentName},

Berikut ini kami sampaikan rekapitulasi kehadiran ananda:
👤 *Nama:* ${selectedStudent.name}
🏫 *Kelas:* ${selectedStudent.studentClass}
🔢 *NIS:* ${selectedStudent.nis}
📅 *Periode:* ${formatIndonesianDate(startDate)} s/d ${formatIndonesianDate(endDate)}

*RINGKASAN KEHADIRAN:*
✅ Total Pertemuan: ${totalDays} hari
🎯 Kehadiran Tepat Waktu: ${tepatCount} hari
⚠️ Terlambat: ${terlambatCount} hari (Total: ±${totalLateMinutes} menit)
🩺 Sakit: ${sakitCount} hari
📋 Izin: ${izinCount} hari
❌ Alpa / Tanpa Keterangan: ${alpaCount} hari

📊 *Tingkat Kehadiran:* ${attendanceRate}%
Status: *${qualification.label}*

Terima kasih atas perhatian dan kerja sama Bapak/Ibu dalam membimbing ananda tercinta.

_Wali Kelas & Kesiswaan ${settings.schoolName}_`;
  };

  const handleExportCSV = () => {
    if (!selectedStudent) return;
    const headers = [
      'Tanggal',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Jam Masuk',
      'Jam Pulang',
      'Status',
      'Keterangan',
    ];
    const rows = studentRecords.map((r) => [
      r.date,
      `"${r.studentNis}"`,
      `"${r.studentName}"`,
      `"${r.studentClass}"`,
      r.checkInTime,
      r.checkOutTime || '-',
      getStatusLabel(r.status),
      `"${r.notes || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `rapor_kehadiran_${selectedStudent.nis}_${startDate}_sd_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Laporan Kemajuan Presensi Siswa Individual
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluasi kehadiran personal, akumulasi keterlambatan, riwayat tanggal presensi, dan cetak rapor presensi resmi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedStudent && onDeleteStudentRecords && allSelectedStudentRecordsCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua ({allSelectedStudentRecordsCount})</span>
            </button>
          )}

          <button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={!selectedStudent}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Unduh PDF Rapor</span>
          </button>

          {selectedStudent && (
            <a
              href={createWhatsAppUrl(selectedStudent.parentPhone, generateWhatsAppReport())}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Rapor ke WA Ortu</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Grid: Student Selector Left (3 cols), Detailed Report Right (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Directory Picker */}
        <div className="no-print lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Pilih Siswa
            </h3>

            {/* Filter by class */}
            <div className="space-y-2 mb-3">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="all">Semua Kelas ({students.length})</option>
                {uniqueClasses.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Students list */}
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredStudentList.map((st) => {
                const isSelected = st.id === currentStudentId;
                return (
                  <button
                    key={st.id}
                    onClick={() => setCurrentStudentId(st.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          st.gender === 'L'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {st.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-900 block truncate">
                          {st.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {st.studentClass} · NIS: {st.nis}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isSelected ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Comprehensive Student Individual Report */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Student Header Card */}
          {selectedStudent && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                    {selectedStudent.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedStudent.name}
                      </h2>
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded">
                        {selectedStudent.studentClass}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      NIS: {selectedStudent.nis} · NISN: {selectedStudent.nisn || '-'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Wali: <span className="font-semibold">{selectedStudent.parentName}</span> ·{' '}
                      <span className="text-emerald-700 font-mono">+{selectedStudent.parentPhone}</span>
                    </p>
                  </div>
                </div>

                {/* Overall Attendance Rate Meter */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center sm:text-right min-w-[150px]">
                  <span className="text-[11px] text-slate-500 block font-medium">
                    Tingkat Kehadiran
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                    {attendanceRate}%
                  </span>
                  <div className="mt-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${qualification.badge}`}
                    >
                      {attendanceRate >= 85 ? 'Memenuhi Syarat' : 'Perlu Perhatian'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date Range Selector Strip */}
              <div className="no-print mt-4 pt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 font-medium">Rentang Evaluasi:</span>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent font-medium text-slate-700 focus:outline-none"
                    />
                    <span className="text-slate-400">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent font-medium text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preset buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDatePreset('7days')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-medium"
                  >
                    7 Hari
                  </button>
                  <button
                    onClick={() => setDatePreset('30days')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-medium"
                  >
                    30 Hari
                  </button>
                  <button
                    onClick={() => setDatePreset('this_month')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-medium"
                  >
                    Bulan Ini
                  </button>
                  <button
                    onClick={() => setDatePreset('semester')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-medium"
                  >
                    Semester Ini
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics Matrix Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-400 block font-medium">Hari Efektif</span>
              <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                {totalDays}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">pertemuan</span>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] text-emerald-700 block font-medium">Tepat Waktu</span>
              <span className="text-xl font-bold text-emerald-800 font-mono tabular-nums">
                {tepatCount}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">hari hadir</span>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70">
              <span className="text-[11px] text-amber-700 block font-medium">Terlambat</span>
              <span className="text-xl font-bold text-amber-800 font-mono tabular-nums">
                {terlambatCount}
              </span>
              <span className="text-[10px] text-amber-600 block mt-0.5">
                ±{totalLateMinutes} menit
              </span>
            </div>

            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/70">
              <span className="text-[11px] text-blue-700 block font-medium">Sakit</span>
              <span className="text-xl font-bold text-blue-800 font-mono tabular-nums">
                {sakitCount}
              </span>
              <span className="text-[10px] text-blue-600 block mt-0.5">surat dokter</span>
            </div>

            <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200/70">
              <span className="text-[11px] text-purple-700 block font-medium">Izin</span>
              <span className="text-xl font-bold text-purple-800 font-mono tabular-nums">
                {izinCount}
              </span>
              <span className="text-[10px] text-purple-600 block mt-0.5">izin keluarga</span>
            </div>

            <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/70">
              <span className="text-[11px] text-rose-700 block font-medium">Alpa / Bolos</span>
              <span className="text-xl font-bold text-rose-800 font-mono tabular-nums">
                {alpaCount}
              </span>
              <span className="text-[10px] text-rose-600 block mt-0.5">tanpa ket.</span>
            </div>
          </div>

          {/* Qualification Banner */}
          <div className={`p-4 rounded-xl border ${qualification.color} flex items-start gap-3`}>
            <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Status Evaluasi Kehadiran: {qualification.label}</p>
              <p className="mt-0.5 opacity-90">
                {attendanceRate >= 85
                  ? 'Siswa memenuhi syarat ambang batas 85% untuk mengikuti Ujian Akhir Semester dan evaluasi belajar resmi tanpa catatan penugasan khusus.'
                  : 'Siswa memerlukan bimbingan wali kelas dan konseling untuk meningkatkan ketepatan waktu hadir di sekolah sebelum periode evaluasi semester berakhir.'}
              </p>
            </div>
          </div>

          {/* Historical Log Table for this Student */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Tanggal Absensi Lengkap Siswa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan {studentRecords.length} rekaman presensi dalam rentang waktu yang dipilih
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Ekspor CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Tanggal</th>
                    <th className="py-2.5 px-4">Jam Masuk</th>
                    <th className="py-2.5 px-4">Jam Pulang</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Keterangan / Catatan</th>
                    <th className="py-2.5 px-4 text-right">Laporan WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {formatIndonesianDate(r.date)}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700">
                        {r.checkInTime}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                        {r.checkOutTime || '-'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.status === 'hadir_tepat'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'terlambat'
                              ? 'bg-amber-100 text-amber-800'
                              : r.status === 'sakit'
                              ? 'bg-blue-100 text-blue-800'
                              : r.status === 'izin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {getStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">
                        {r.notes || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {r.whatsappNotification.sent ? (
                          <span className="text-[11px] font-mono text-emerald-700 font-medium">
                            Terkirim
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Belum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {studentRecords.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Tidak ada data absensi untuk siswa ini dalam rentang tanggal yang ditentukan.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINTABLE OFFICIAL INDIVIDUAL STUDENT REPORT MODAL */}
      {isPrintModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header (No Print) */}
            <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Pratinjau Rapor Presensi Siswa Individual (Format Cetak / PDF)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Printable Letterhead & Report Content */}
            <div className="overflow-y-auto p-8 bg-white print:p-0 print-container">
              {/* Kop Surat Sekolah Resmi */}
              <div className="flex items-center justify-between gap-4 border-b-4 border-double border-slate-900 pb-3 mb-6">
                <SchoolLogo
                  logoUrl={settings.schoolLogo}
                  schoolName={settings.schoolName}
                  className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 print:border-0"
                  imgClassName="w-full h-full object-contain"
                  fallbackIconClassName="w-8 h-8 text-slate-700"
                />
                <div className="text-center flex-1">
                  <p className="text-xs uppercase font-bold tracking-widest text-slate-700">
                    PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA
                  </p>
                  <p className="text-xs uppercase font-bold tracking-wider text-slate-800">
                    DINAS PENDIDIKAN DAN KEBUDAYAAN
                  </p>
                  <h2 className="text-lg font-extrabold uppercase text-slate-900 tracking-tight mt-0.5">
                    {settings.schoolName}
                  </h2>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {settings.address} · NPSN: {settings.npsn}
                  </p>
                </div>
                <div className="w-16 shrink-0" aria-hidden="true" />
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline">
                  LEMBAR LAPORAN REKAPITULASI KEHADIRAN SISWA INDIVIDUAL
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tahun Ajaran {settings.academicYear} ({settings.semester})
                </p>
              </div>

              {/* Student Identity Box */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-4 rounded-lg text-xs mb-6">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-32 text-slate-500">Nama Siswa</span>
                    <span className="font-bold text-slate-900">: {selectedStudent.name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500">NIS / NISN</span>
                    <span className="font-mono text-slate-900">
                      : {selectedStudent.nis} / {selectedStudent.nisn || '-'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500">Kelas / Rombel</span>
                    <span className="font-bold text-slate-900">: {selectedStudent.studentClass}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-32 text-slate-500">Orang Tua / Wali</span>
                    <span className="font-bold text-slate-900">: {selectedStudent.parentName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500">Kontak WhatsApp</span>
                    <span className="font-mono text-slate-900">: +{selectedStudent.parentPhone}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-slate-500">Periode Evaluasi</span>
                    <span className="text-slate-900">
                      : {formatIndonesianDate(startDate)} s/d {formatIndonesianDate(endDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Statistics Table */}
              <div className="grid grid-cols-6 border border-slate-300 text-center text-xs mb-6 font-medium">
                <div className="p-2.5 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Total Hari</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{totalDays}</span>
                </div>
                <div className="p-2.5 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Tepat Waktu</span>
                  <span className="font-bold text-emerald-700 text-sm font-mono">{tepatCount}</span>
                </div>
                <div className="p-2.5 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Terlambat</span>
                  <span className="font-bold text-amber-700 text-sm font-mono">{terlambatCount}</span>
                </div>
                <div className="p-2.5 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Izin / Sakit</span>
                  <span className="font-bold text-blue-700 text-sm font-mono">{izinCount + sakitCount}</span>
                </div>
                <div className="p-2.5 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Alpa</span>
                  <span className="font-bold text-rose-700 text-sm font-mono">{alpaCount}</span>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block">Persentase</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{attendanceRate}%</span>
                </div>
              </div>

              {/* Qualification Note */}
              <div className="border border-slate-300 p-3 rounded-lg text-xs mb-6">
                <p className="font-bold text-slate-900">Status Kedisiplinan & Catatan Evaluasi:</p>
                <p className="text-slate-700 mt-0.5">
                  Ananda {selectedStudent.name} tercatat memiliki tingkat kehadiran sebesar{' '}
                  <span className="font-bold">{attendanceRate}%</span> ({qualification.label}).{' '}
                  {totalLateMinutes > 0
                    ? `Tercatat akumulasi keterlambatan sebanyak ${terlambatCount} kali (total ±${totalLateMinutes} menit).`
                    : 'Tidak ada catatan keterlambatan signifikan.'}
                </p>
              </div>

              {/* Detailed Dates Table */}
              <table className="w-full text-left text-xs border border-slate-300 mb-8">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="py-2 px-3 border-r border-slate-300 w-10 text-center">No</th>
                    <th className="py-2 px-3 border-r border-slate-300">Tanggal</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Jam Masuk</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Jam Pulang</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Status</th>
                    <th className="py-2 px-3">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {studentRecords.map((item, index) => (
                    <tr key={item.id} className="text-[11px]">
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-mono">
                        {index + 1}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 font-medium">
                        {formatIndonesianDate(item.date)}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-mono">
                        {item.checkInTime}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-mono">
                        {item.checkOutTime || '-'}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-medium">
                        {getStatusLabel(item.status)}
                      </td>
                      <td className="py-1.5 px-3">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 3-Party Signatures */}
              <div className="grid grid-cols-3 text-xs text-slate-800 text-center pt-2">
                <div>
                  <p>Orang Tua / Wali Murid,</p>
                  <div className="h-16" />
                  <p className="font-bold underline">{selectedStudent.parentName}</p>
                </div>

                <div>
                  <p>Wali Kelas {selectedStudent.studentClass},</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Siti Rahmawati, S.Pd.</p>
                  <p className="text-[10px] text-slate-600 font-mono">NIP. 19820315 200604 2 008</p>
                </div>

                <div>
                  <p>Jakarta, {formatIndonesianDate(todayStr)}</p>
                  <p className="font-medium">Kepala Sekolah,</p>
                  <div className="h-16" />
                  <p className="font-bold underline">{settings.principalName}</p>
                  <p className="text-[10px] text-slate-600 font-mono">NIP. {settings.principalNip}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete All Records for Selected Student Modal */}
      {confirmDeleteOpen && selectedStudent && onDeleteStudentRecords && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Semua Riwayat Presensi Siswa?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Seluruh {allSelectedStudentRecordsCount} catatan presensi milik{' '}
                  <strong>{selectedStudent.name}</strong> ({selectedStudent.studentClass}) akan dihapus permanen dari aplikasi &amp; Google Spreadsheet.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudentRecords(selectedStudent.id);
                  setConfirmDeleteOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
