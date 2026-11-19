import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  PlusCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserX,
  FileText,
  School,
  X,
  MessageSquare,
  Phone,
  Trash2,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, SchoolSettings, Student } from '../types/attendance';
import {
  createWhatsAppUrl,
  formatIndonesianDate,
  generateNotificationMessage,
  getStatusLabel,
} from '../utils/whatsapp';
import { SchoolLogo } from './SchoolLogo';

interface AttendanceReportProps {
  records: AttendanceRecord[];
  students: Student[];
  settings: SchoolSettings;
  onAddManualRecord: (record: AttendanceRecord) => void;
  onDeleteAllRecords: () => void;
  onDeleteRecordsByDate?: (date: string) => void;
  templates: { [key: string]: string };
}

export const AttendanceReport: React.FC<AttendanceReportProps> = ({
  records,
  students,
  settings,
  onAddManualRecord,
  onDeleteAllRecords,
  onDeleteRecordsByDate,
  templates,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Permit form state
  const [permitStudentId, setPermitStudentId] = useState(students[0]?.id || '');
  const [permitStatus, setPermitStatus] = useState<'izin' | 'sakit' | 'hadir_tepat'>('izin');
  const [permitNotes, setPermitNotes] = useState('');

  const dateRecordsCount = useMemo(
    () => records.filter((r) => r.date === selectedDate).length,
    [records, selectedDate]
  );

  const uniqueClasses = Array.from(new Set(students.map((s) => s.studentClass))).sort();

  // Combine attendance records with any student not recorded on selectedDate as 'alpa' (belum hadir)
  const fullListForDate = useMemo(() => {
    const dateRecords = records.filter((r) => r.date === selectedDate);
    const recordedStudentIds = new Set(dateRecords.map((r) => r.studentId));

    // Combine
    const combined: AttendanceRecord[] = [...dateRecords];

    // For students not recorded on this date, represent as 'alpa'
    students.forEach((s) => {
      if (!recordedStudentIds.has(s.id)) {
        combined.push({
          id: `unrecorded-${selectedDate}-${s.id}`,
          studentId: s.id,
          studentName: s.name,
          studentNis: s.nis,
          studentClass: s.studentClass,
          parentPhone: s.parentPhone,
          parentName: s.parentName,
          date: selectedDate,
          checkInTime: '-',
          status: 'alpa',
          type: 'masuk',
          notes: 'Belum melakukan absensi pada tanggal ini',
          whatsappNotification: {
            sent: false,
            status: 'pending',
            phone: s.parentPhone,
          },
        });
      }
    });

    return combined.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [records, selectedDate, students]);

  // Apply filters
  const filtered = useMemo(() => {
    return fullListForDate.filter((r) => {
      const matchSearch =
        r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.studentNis.includes(search);
      const matchClass = selectedClass === 'all' || r.studentClass === selectedClass;
      const matchStatus = selectedStatus === 'all' || r.status === selectedStatus;
      return matchSearch && matchClass && matchStatus;
    });
  }, [fullListForDate, search, selectedClass, selectedStatus]);

  // Summary counts for filtered date
  const summary = useMemo(() => {
    const list = selectedClass === 'all'
      ? fullListForDate
      : fullListForDate.filter((r) => r.studentClass === selectedClass);

    return {
      total: list.length,
      hadirTepat: list.filter((r) => r.status === 'hadir_tepat').length,
      terlambat: list.filter((r) => r.status === 'terlambat').length,
      sakit: list.filter((r) => r.status === 'sakit').length,
      izin: list.filter((r) => r.status === 'izin').length,
      alpa: list.filter((r) => r.status === 'alpa').length,
    };
  }, [fullListForDate, selectedClass]);

  // Handle submit manual permit/sick input
  const handleSavePermit = (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === permitStudentId);
    if (!st) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newRecord: AttendanceRecord = {
      id: `rec-${selectedDate}-${st.id}-manual-${Date.now()}`,
      studentId: st.id,
      studentName: st.name,
      studentNis: st.nis,
      studentClass: st.studentClass,
      parentPhone: st.parentPhone,
      parentName: st.parentName,
      date: selectedDate,
      checkInTime: timeStr,
      status: permitStatus,
      type: 'masuk',
      notes: permitNotes || `Permohonan ${permitStatus} dari orang tua`,
      whatsappNotification: {
        sent: true,
        sentAt: `${selectedDate} ${timeStr}`,
        status: 'terkirim',
        phone: st.parentPhone,
        message: '',
      },
    };

    const tmpl = templates['izin_sakit'] || 'Permohonan {status} ananda {nama_siswa} telah tercatat.';
    newRecord.whatsappNotification.message = generateNotificationMessage(tmpl, {
      student: st,
      record: newRecord,
      settings,
      notes: newRecord.notes,
    });

    onAddManualRecord(newRecord);
    setIsPermitModalOpen(false);
    setPermitNotes('');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Tanggal',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Jam Masuk',
      'Jam Pulang',
      'Status',
      'Catatan',
      'Wali Murid',
      'No WA Ortu',
    ];
    const rows = filtered.map((r) => [
      r.date,
      `"${r.studentNis}"`,
      `"${r.studentName}"`,
      `"${r.studentClass}"`,
      r.checkInTime,
      r.checkOutTime || '-',
      getStatusLabel(r.status),
      `"${r.notes || ''}"`,
      `"${r.parentName}"`,
      `"${r.parentPhone}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan_absensi_${selectedDate}_${selectedClass}.csv`);
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
            Rekapitulasi & Laporan Presensi
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring data presensi per tanggal, kelas, pencatatan izin sakit, serta cetak laporan resmi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua ({records.length})</span>
            </button>
          )}

          <button
            onClick={() => setIsPermitModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Input Izin / Sakit</span>
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan Resmi</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Strip */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
            />
          </div>

          {/* Quick Date buttons */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedDate === new Date().toISOString().split('T')[0]
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
          </div>

          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Semua Kelas</option>
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Semua Status</option>
            <option value="hadir_tepat">Hadir Tepat Waktu</option>
            <option value="terlambat">Hadir Terlambat</option>
            <option value="sakit">Sakit</option>
            <option value="izin">Izin</option>
            <option value="alpa">Belum Hadir / Alpa</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Cari siswa atau NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
            />
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Ekspor CSV</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-400 block">Total Siswa</span>
          <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
            {summary.total}
          </span>
        </div>
        <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60">
          <span className="text-[11px] text-emerald-700 block font-medium">Tepat Waktu</span>
          <span className="text-lg font-bold text-emerald-800 font-mono tabular-nums">
            {summary.hadirTepat}
          </span>
        </div>
        <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
          <span className="text-[11px] text-amber-700 block font-medium">Terlambat</span>
          <span className="text-lg font-bold text-amber-800 font-mono tabular-nums">
            {summary.terlambat}
          </span>
        </div>
        <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/60">
          <span className="text-[11px] text-blue-700 block font-medium">Sakit</span>
          <span className="text-lg font-bold text-blue-800 font-mono tabular-nums">
            {summary.sakit}
          </span>
        </div>
        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/60">
          <span className="text-[11px] text-indigo-700 block font-medium">Izin</span>
          <span className="text-lg font-bold text-indigo-800 font-mono tabular-nums">
            {summary.izin}
          </span>
        </div>
        <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/60">
          <span className="text-[11px] text-rose-700 block font-medium">Alpa / Belum Absen</span>
          <span className="text-lg font-bold text-rose-800 font-mono tabular-nums">
            {summary.alpa}
          </span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Keterangan / Catatan</th>
                <th className="py-3 px-4 text-right">Laporan WA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {r.studentName}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.studentNis}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{r.studentClass}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                    {r.checkInTime}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                    {r.checkOutTime || '-'}
                  </td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                    {r.notes || '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={createWhatsAppUrl(
                        r.parentPhone,
                        `Yth. Bapak/Ibu ${r.parentName}, laporan kehadiran ananda ${r.studentName} (${r.studentClass}) pada ${formatIndonesianDate(r.date)} berstatus: ${getStatusLabel(r.status)}. Keterangan: ${r.notes || 'Normal'}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium font-mono"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kirim WA</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Tidak ada catatan absensi untuk kriteria tanggal dan filter yang dipilih.
          </div>
        )}
      </div>

      {/* Manual Sick / Permission Modal */}
      {isPermitModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Pencatatan Surat Izin / Sakit
              </h3>
              <button
                onClick={() => setIsPermitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePermit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pilih Siswa *</label>
                <select
                  value={permitStudentId}
                  onChange={(e) => setPermitStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentClass} - NIS: {s.nis})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Status Kehadiran *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermitStatus('izin')}
                    className={`p-2.5 rounded-lg border text-center font-semibold transition-all ${
                      permitStatus === 'izin'
                        ? 'bg-purple-50 border-purple-500 text-purple-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Izin Keluarga / Acara
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermitStatus('sakit')}
                    className={`p-2.5 rounded-lg border text-center font-semibold transition-all ${
                      permitStatus === 'sakit'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Sakit (Surat Dokter)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Keterangan / Alasan Lengkap
                </label>
                <textarea
                  rows={3}
                  value={permitNotes}
                  onChange={(e) => setPermitNotes(e.target.value)}
                  placeholder="Contoh: Sakit demam tinggi, surat dokter terlampir..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Sistem otomatis menyiapkan notifikasi konfirmasi WhatsApp ke orang tua murid.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPermitModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Official School Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Pratinjau Laporan Resmi Presensi Sekolah
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Letterhead & Table */}
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

              {/* Title of Document */}
              <div className="text-center mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline">
                  LAPORAN REKAPITULASI PRESENSI KEHADIRAN SISWA
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tanggal: {formatIndonesianDate(selectedDate)} · Kelas:{' '}
                  {selectedClass === 'all' ? 'Semua Kelas' : selectedClass}
                </p>
              </div>

              {/* Statistics Breakdown */}
              <div className="grid grid-cols-5 border border-slate-300 text-center text-xs mb-6 font-medium">
                <div className="p-2 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Total Siswa</span>
                  <span className="font-bold text-slate-900">{summary.total}</span>
                </div>
                <div className="p-2 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Tepat Waktu</span>
                  <span className="font-bold text-slate-900">{summary.hadirTepat}</span>
                </div>
                <div className="p-2 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Terlambat</span>
                  <span className="font-bold text-slate-900">{summary.terlambat}</span>
                </div>
                <div className="p-2 border-r border-slate-300">
                  <span className="text-[10px] text-slate-500 block">Sakit / Izin</span>
                  <span className="font-bold text-slate-900">{summary.sakit + summary.izin}</span>
                </div>
                <div className="p-2">
                  <span className="text-[10px] text-slate-500 block">Alpa / Tanpa Ket.</span>
                  <span className="font-bold text-slate-900">{summary.alpa}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="py-2 px-3 border-r border-slate-300 w-10 text-center">No</th>
                    <th className="py-2 px-3 border-r border-slate-300">Nama Siswa</th>
                    <th className="py-2 px-3 border-r border-slate-300">NIS</th>
                    <th className="py-2 px-3 border-r border-slate-300">Kelas</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Waktu Masuk</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Status</th>
                    <th className="py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {filtered.map((item, index) => (
                    <tr key={item.id} className="text-[11px]">
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-mono">
                        {index + 1}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 font-semibold">
                        {item.studentName}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 font-mono">
                        {item.studentNis}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300">{item.studentClass}</td>
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-mono">
                        {item.checkInTime}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-300 text-center font-medium">
                        {getStatusLabel(item.status)}
                      </td>
                      <td className="py-1.5 px-3">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signature Blocks */}
              <div className="mt-10 grid grid-cols-2 text-xs text-slate-800 pt-4">
                <div className="text-center">
                  <p>Mengetahui,</p>
                  <p className="font-medium">Guru Piket / Kesiswaan</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Siti Rahmawati, S.Pd.</p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    NIP. 19820315 200604 2 008
                  </p>
                </div>

                <div className="text-center">
                  <p>Jakarta, {formatIndonesianDate(selectedDate)}</p>
                  <p className="font-medium">Kepala Sekolah {settings.schoolName}</p>
                  <div className="h-16" />
                  <p className="font-bold underline">{settings.principalName}</p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    NIP. {settings.principalNip}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete All Attendance Records Modal */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Data Rekapitulasi Presensi?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Tersedia <strong>{records.length}</strong> rekaman presensi tersimpan
                  {dateRecordsCount > 0 ? ` (${dateRecordsCount} pada tanggal ${formatIndonesianDate(selectedDate)})` : ''}.
                  Data yang dihapus juga akan dibersihkan dari Google Spreadsheet.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onDeleteAllRecords();
                  setConfirmDeleteOpen(false);
                }}
                className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Ya, Hapus Semua ({records.length} Rekaman)
              </button>
              {onDeleteRecordsByDate && dateRecordsCount > 0 && dateRecordsCount < records.length && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRecordsByDate(selectedDate);
                    setConfirmDeleteOpen(false);
                  }}
                  className="w-full px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Hapus Tanggal {formatIndonesianDate(selectedDate)} Saja ({dateRecordsCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
