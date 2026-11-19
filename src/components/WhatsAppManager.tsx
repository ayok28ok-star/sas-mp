import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Send,
  CheckCheck,
  AlertCircle,
  Copy,
  ExternalLink,
  Phone,
  RefreshCw,
  Search,
  Filter,
  Check,
  Smartphone,
  ShieldCheck,
  FileEdit,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AttendanceRecord,
  NotificationLog,
  SchoolSettings,
  Student,
  WhatsAppTemplate,
} from '../types/attendance';
import {
  createWhatsAppUrl,
  formatIndonesianDate,
  formatWhatsAppNumber,
  generateNotificationMessage,
  getStatusLabel,
} from '../utils/whatsapp';

interface WhatsAppManagerProps {
  students: Student[];
  records: AttendanceRecord[];
  templates: WhatsAppTemplate[];
  onUpdateTemplate: (template: WhatsAppTemplate) => void;
  logs: NotificationLog[];
  onAddLog: (log: NotificationLog) => void;
  settings: SchoolSettings;
  defaultBlastFilter?: 'absent' | 'late' | null;
}

export const WhatsAppManager: React.FC<WhatsAppManagerProps> = ({
  students,
  records,
  templates,
  onUpdateTemplate,
  logs,
  onAddLog,
  settings,
  defaultBlastFilter,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'blast' | 'templates' | 'logs'>(
    defaultBlastFilter ? 'blast' : 'blast'
  );

  // Blast Target selector
  const [blastCategory, setBlastCategory] = useState<'absent' | 'late' | 'all_present'>(
    defaultBlastFilter === 'late' ? 'late' : 'absent'
  );
  const [blastClassFilter, setBlastClassFilter] = useState('all');
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Template editor state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tmpl-1');
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const [editingTemplateText, setEditingTemplateText] = useState(currentTemplate?.text || '');
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState(false);

  // Sync editor when selected template changes
  React.useEffect(() => {
    if (currentTemplate) {
      setEditingTemplateText(currentTemplate.text);
    }
  }, [selectedTemplateId, currentTemplate]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayRecords = useMemo(() => records.filter((r) => r.date === todayStr), [records, todayStr]);

  // Determine students who haven't arrived today
  const absentStudents = useMemo(() => {
    const presentIds = new Set(todayRecords.map((r) => r.studentId));
    return students.filter(
      (s) => !presentIds.has(s.id) && (blastClassFilter === 'all' || s.studentClass === blastClassFilter)
    );
  }, [students, todayRecords, blastClassFilter]);

  // Determine late students today
  const lateStudents = useMemo(() => {
    return todayRecords
      .filter((r) => r.status === 'terlambat' && (blastClassFilter === 'all' || r.studentClass === blastClassFilter))
      .map((r) => {
        const student = students.find((s) => s.id === r.studentId);
        return { record: r, student };
      })
      .filter((item): item is { record: AttendanceRecord; student: Student } => !!item.student);
  }, [todayRecords, students, blastClassFilter]);

  const uniqueClasses = Array.from(new Set(students.map((s) => s.studentClass))).sort();

  // Save template edit
  const handleSaveTemplate = () => {
    if (!currentTemplate) return;
    const updated: WhatsAppTemplate = {
      ...currentTemplate,
      text: editingTemplateText,
    };
    onUpdateTemplate(updated);
    setTemplateSavedFeedback(true);
    setTimeout(() => setTemplateSavedFeedback(false), 2500);
  };

  // Preview dummy student for the template editor
  const previewStudent = students[0] || {
    id: 'preview',
    name: 'Muhammad Farhan Pratama',
    nis: '23241001',
    nisn: '0071234001',
    gender: 'L',
    studentClass: 'VII A',
    parentName: 'H. Suryanto Pratama',
    parentPhone: '6281234567801',
    qrCodeData: 'SMPN1-FARHAN',
    status: 'aktif',
  };

  const previewMessage = useMemo(() => {
    return generateNotificationMessage(editingTemplateText, {
      student: previewStudent,
      settings,
      notes: 'Tepat waktu sebelum bel masuk',
    });
  }, [editingTemplateText, previewStudent, settings]);

  // Handle send single blast
  const handleSendBlastItem = (student: Student, templateType: string, customNotes?: string) => {
    const tmpl = templates.find((t) => t.type === templateType) || templates[0];
    const message = generateNotificationMessage(tmpl.text, {
      student,
      settings,
      notes: customNotes,
    });

    const newLog: NotificationLog = {
      id: `log-${Date.now()}-${student.id}`,
      timestamp: `${todayStr} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      studentName: student.name,
      studentClass: student.studentClass,
      parentName: student.parentName,
      recipientPhone: student.parentPhone,
      messageType: tmpl.title,
      content: message,
      status: 'terkirim',
    };

    onAddLog(newLog);

    // Open WhatsApp
    const url = createWhatsAppUrl(student.parentPhone, message);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pusat Notifikasi & Laporan WhatsApp Orang Tua
            </h1>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" />
              API Gateway Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem pengiriman laporan kehadiran otomatis, siaran massal (blast) wali murid, dan kustomisasi template pesan resmi
          </p>
        </div>

        {/* Subtab selection */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveSubTab('blast')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'blast'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Siaran Massal (Blast)
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'templates'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Template Pesan Resmi
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat Log Pengiriman ({logs.length})
          </button>
        </div>
      </div>

      {/* Subtab 1: WhatsApp Blast / Broadcast Center */}
      {activeSubTab === 'blast' && (
        <div className="space-y-6">
          {/* Target Filter Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Target Siaran Notifikasi (WhatsApp Broadcast)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih kelompok orang tua murid yang ingin dikirimkan notifikasi serentak hari ini
                </p>
              </div>

              {/* Target Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setBlastCategory('absent')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    blastCategory === 'absent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Siswa Belum Hadir / Alpa ({absentStudents.length})</span>
                </button>

                <button
                  onClick={() => setBlastCategory('late')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    blastCategory === 'late'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Siswa Terlambat Hari Ini ({lateStudents.length})</span>
                </button>

                <select
                  value={blastClassFilter}
                  onChange={(e) => setBlastClassFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
                >
                  <option value="all">Semua Kelas</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      Kelas {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Target List */}
          {blastCategory === 'absent' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Daftar {absentStudents.length} Siswa Belum Absen Hari Ini
                  </h4>
                  <p className="text-xs text-slate-500">
                    Siswa belum melakukan scan presensi wajah hingga saat ini. Kirimkan pesan konfirmasi ke nomor WhatsApp wali murid.
                  </p>
                </div>
              </div>

              {absentStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {absentStudents.map((st) => {
                    const warnTmpl =
                      templates.find((t) => t.type === 'peringatan_alpa') || templates[0];
                    const msg = generateNotificationMessage(warnTmpl.text, {
                      student: st,
                      settings,
                    });

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/30 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {st.name}
                            </span>
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.2 rounded">
                              {st.studentClass}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Wali Murid: <span className="font-medium">{st.parentName}</span>
                          </p>
                          <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                            WA: +{st.parentPhone}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSendBlastItem(st, 'peringatan_alpa')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim Peringatan</span>
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg);
                              alert('Teks pesan berhasil disalin ke clipboard!');
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded text-[11px] font-medium border border-slate-200 transition-colors"
                          >
                            Salin Format
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-emerald-600 bg-emerald-50/50 rounded-xl border border-emerald-200/50">
                  <CheckCheck className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                  Alhamdulillah, seluruh siswa ({students.length} siswa) telah hadir atau memiliki catatan kehadiran resmi!
                </div>
              )}
            </div>
          )}

          {blastCategory === 'late' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Daftar {lateStudents.length} Siswa Terlambat Hari Ini
                  </h4>
                  <p className="text-xs text-slate-500">
                    Kirimkan notifikasi pemberitahuan jam kedatangan siswa kepada orang tua untuk meningkatkan kedisiplinan.
                  </p>
                </div>
              </div>

              {lateStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lateStudents.map(({ student, record }) => {
                    const lateTmpl =
                      templates.find((t) => t.type === 'masuk_terlambat') || templates[0];
                    const msg = generateNotificationMessage(lateTmpl.text, {
                      student,
                      record,
                      settings,
                      notes: record.notes,
                    });

                    return (
                      <div
                        key={student.id}
                        className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {student.name}
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.2 rounded font-mono">
                              Masuk: {record.checkInTime}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Kelas: {student.studentClass} · Wali: {student.parentName}
                          </p>
                          <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                            WA: +{student.parentPhone}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSendBlastItem(student, 'masuk_terlambat', record.notes)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim Laporan WA</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                  Tidak ada siswa yang tercatat terlambat hari ini.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Message Template Editor */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Template Selector & Text Editor */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Kustomisasi Template Pesan WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sesuaikan narasi pesan resmi agar ramah, formal, dan mencerminkan nilai sekolah
                  </p>
                </div>
              </div>

              {/* Template Category Pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedTemplateId === tmpl.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>

              {/* Available Placeholders Tags */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] mb-4">
                <span className="font-semibold text-slate-700 block mb-1.5">
                  Variabel Dinamis yang Dapat Digunakan:
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{nama_siswa}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{kelas}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{nis}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{nama_ortu}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{sekolah}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{waktu}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{tanggal}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{status}`}</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-700">{`{catatan}`}</span>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Isi Format Pesan ({currentTemplate?.title})
                </label>
                <textarea
                  rows={12}
                  value={editingTemplateText}
                  onChange={(e) => setEditingTemplateText(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {templateSavedFeedback ? (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    Template berhasil disimpan dan diterapkan!
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Perubahan langsung berlaku untuk semua scan berikutnya.
                  </span>
                )}

                <button
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Simpan Template
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic WhatsApp Phone Mockup Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Preview di WhatsApp Penerima
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">07:02 WIB</span>
              </div>

              {/* Chat Simulation Container */}
              <div className="mt-4 bg-[#0B141A] rounded-xl p-3 border border-slate-800 min-h-[360px] flex flex-col justify-end">
                {/* Chat Top Bar */}
                <div className="flex items-center gap-2.5 p-2 bg-[#202C33] rounded-lg mb-4 text-xs">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                    SN
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-xs truncate">
                      {settings.botSenderName}
                    </p>
                    <p className="text-[10px] text-emerald-400">Online · Akun Resmi Sekolah</p>
                  </div>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="max-w-[92%] bg-[#005C4B] text-white rounded-lg rounded-tl-none p-3 text-[11px] leading-relaxed relative shadow-md self-start">
                  <pre className="whitespace-pre-wrap font-sans text-[11px] select-text">
                    {previewMessage}
                  </pre>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200 mt-2 font-mono">
                    <span>07:05</span>
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-800/80 rounded-xl text-[11px] text-slate-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Pesan di atas akan diterima oleh orang tua/wali murid dengan nama siswa dan waktu kedatangan yang terisi otomatis.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Live Transmission Logs */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Log Transmisi Pengiriman WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Riwayat lengkap seluruh notifikasi yang terkirim ke wali murid
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Wali Murid</th>
                  <th className="py-3 px-4">Nomor WhatsApp</th>
                  <th className="py-3 px-4">Jenis Pesan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{log.studentName}</td>
                    <td className="py-3 px-4 text-slate-600">{log.studentClass}</td>
                    <td className="py-3 px-4 text-slate-800">{log.parentName}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">+{log.recipientPhone}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {log.messageType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Terkirim
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={createWhatsAppUrl(log.recipientPhone, log.content)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                        <span>Kirim Ulang</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
