import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Plus,
  ScanFace,
  Download,
  Edit2,
  Trash2,
  Printer,
  X,
  Phone,
  FileSpreadsheet,
  Camera,
  ImagePlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SwitchCamera,
  ExternalLink,
  CloudCheck,
  CloudOff,
} from 'lucide-react';
import { SchoolClass, SchoolSettings, Student } from '../types/attendance';
import { createWhatsAppUrl } from '../utils/whatsapp';
import {
  analyzeFrameLighting,
  captureVideoFrameCanvas,
  detectSingleFaceWithDescriptor,
  loadFaceModels,
  loadImageFromFile,
} from '../utils/faceRecognition';
import { SheetsSyncService, SheetsSyncStatus } from '../services/sheetsSync';

interface StudentManagerProps {
  students: Student[];
  classes?: SchoolClass[];
  onAddStudent: (student: Student) => Promise<boolean> | void;
  onUpdateStudent: (student: Student) => Promise<boolean> | void;
  onDeleteStudent: (id: string) => void;
  onDeleteAllStudents: () => void;
  onOpenCardModal: (student: Student | null) => void;
  onViewProgress?: (studentId: string) => void;
  onOpenSettings?: () => void;
  onSyncSheetsNow?: () => Promise<boolean>;
  settings: SchoolSettings;
}

function normalizeWaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  if (!digits.startsWith('62') && digits.length > 5) return '62' + digits;
  return digits;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  students,
  classes = [],
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteAllStudents,
  onOpenCardModal,
  onViewProgress,
  onOpenSettings,
  onSyncSheetsNow,
  settings,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<SheetsSyncStatus>(() =>
    SheetsSyncService.getStatus()
  );
  const [syncNotice, setSyncNotice] = useState<{
    type: 'ok' | 'warn';
    text: string;
  } | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    nis: '',
    nisn: '',
    gender: 'L' as 'L' | 'P',
    studentClass: 'VII A',
    parentName: '',
    parentPhone: '',
    address: '',
    facePhoto: '',
    faceDescriptor: undefined as number[] | undefined,
  });

  // Biometric enrollment camera / photo states
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceStatusMsg, setFaceStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    isIframeBlocked?: boolean;
  } | null>(null);
  const [isEnrollCamOpen, setIsEnrollCamOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);

  const uniqueClasses = Array.from(
    new Set([
      ...classes.map((c) => c.name),
      ...students.map((s) => s.studentClass),
    ].filter(Boolean))
  ).sort();

  useEffect(() => {
    const unsub = SheetsSyncService.subscribe(() => {
      setSheetsStatus(SheetsSyncService.getStatus());
    });
    return unsub;
  }, []);

  const stopEnrollCamera = () => {
    if (enrollStreamRef.current) {
      enrollStreamRef.current.getTracks().forEach((t) => t.stop());
      enrollStreamRef.current = null;
    }
    if (enrollVideoRef.current) {
      enrollVideoRef.current.srcObject = null;
    }
    setIsEnrollCamOpen(false);
  };

  useEffect(() => {
    if (isModalOpen) {
      loadFaceModels().catch(() => {});
    } else {
      stopEnrollCamera();
    }
    return () => {
      stopEnrollCamera();
    };
  }, [isModalOpen]);

  const startEnrollCamera = async (facingOverride?: 'user' | 'environment') => {
    const targetFacing = facingOverride || cameraFacing;
    setFaceStatusMsg(null);
    try {
      stopEnrollCamera();
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error('Browser tidak mendukung akses kamera langsung (getUserMedia).');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
      enrollStreamRef.current = stream;
      setCameraFacing(targetFacing);
      setIsEnrollCamOpen(true);

      const videoEl = enrollVideoRef.current;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.muted = true;
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
      }
    } catch (err: unknown) {
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch {
        isInIframe = true;
      }
      const errMsg = err instanceof Error ? err.message : String(err || '');
      setFaceStatusMsg({
        type: 'err',
        isIframeBlocked: isInIframe,
        text: isInIframe
          ? 'Kamera langsung dibatasi pada tampilan iframe / pratinjau. Silakan gunakan tombol "Foto Kamera HP" atau "Unggah Foto Wajah" di atas, atau buka di tab penuh.'
          : `Kamera langsung tidak tersedia (${errMsg || 'izin kamera ditolak'}). Silakan gunakan tombol "Foto Kamera HP" atau "Unggah Foto Wajah" di atas.`,
      });
    }
  };

  const captureFromEnrollCamera = async () => {
    const video = enrollVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;
    setFaceDetecting(true);
    setFaceStatusMsg(null);
    try {
      const frameCanvas = captureVideoFrameCanvas(video);
      const source = frameCanvas || video;
      const lighting = analyzeFrameLighting(source);
      const res = await detectSingleFaceWithDescriptor(source);
      if (!res) {
        setFaceStatusMsg({
          type: 'err',
          text:
            lighting?.level === 'dark'
              ? `Wajah tidak terdeteksi karena pencahayaan terlalu gelap (${lighting.scorePct}%). Pindah ke tempat lebih terang lalu coba lagi.`
              : lighting?.level === 'bright'
              ? `Wajah tidak terdeteksi karena cahaya terlalu silau (${lighting.scorePct}%). Hindari sorotan lampu langsung.`
              : 'Wajah tidak terdeteksi di kamera. Posisikan wajah menghadap kamera dengan cahaya cukup.',
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          facePhoto: res.facePhoto,
          faceDescriptor: res.descriptor,
        }));
        setFaceStatusMsg({
          type: 'ok',
          text: 'Wajah berhasil dipindai & 128 fitur biometrik diekstrak!',
        });
        stopEnrollCamera();
      }
    } catch (err: unknown) {
      setFaceStatusMsg({
        type: 'err',
        text: `Gagal memproses foto kamera: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setFaceDetecting(false);
    }
  };

  const handleUploadFacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaceDetecting(true);
    setFaceStatusMsg(null);
    if (isEnrollCamOpen) {
      stopEnrollCamera();
    }
    try {
      const img = await loadImageFromFile(file);
      const lighting = analyzeFrameLighting(img);
      const res = await detectSingleFaceWithDescriptor(img);
      if (!res) {
        setFaceStatusMsg({
          type: 'err',
          text:
            lighting?.level === 'dark'
              ? `Wajah tidak terdeteksi karena foto terlalu gelap (${lighting.scorePct}%). Ambil foto di area yang lebih terang.`
              : lighting?.level === 'bright'
              ? `Wajah tidak terdeteksi karena foto terlalu silau (${lighting.scorePct}%). Hindari backlight / pantulan lampu.`
              : 'Wajah tidak terdeteksi pada foto tersebut. Pilih foto wajah depan yang jelas, terang, dan tidak buram.',
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          facePhoto: res.facePhoto,
          faceDescriptor: res.descriptor,
        }));
        setFaceStatusMsg({
          type: 'ok',
          text: 'Foto wajah valid! Biometrik wajah siap disimpan ke Spreadsheet & dipakai absensi.',
        });
      }
    } catch (err: unknown) {
      setFaceStatusMsg({
        type: 'err',
        text: `Gagal memuat foto wajah: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setFaceDetecting(false);
      e.target.value = '';
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.nis.includes(search) ||
      s.parentName.toLowerCase().includes(search.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.studentClass === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFaceStatusMsg(null);
    setFormData({
      name: '',
      nis: String(Math.floor(23241000 + Math.random() * 900)),
      nisn: '0071' + String(Math.floor(100000 + Math.random() * 900000)),
      gender: 'L',
      studentClass: uniqueClasses[0] || 'VII A',
      parentName: '',
      parentPhone: '628',
      address: '',
      facePhoto: '',
      faceDescriptor: undefined,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFaceStatusMsg(null);
    setFormData({
      name: student.name,
      nis: student.nis,
      nisn: student.nisn || '',
      gender: student.gender,
      studentClass: student.studentClass,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      address: student.address || '',
      facePhoto: student.facePhoto || '',
      faceDescriptor: student.faceDescriptor,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.nis.trim()) {
      return;
    }

    const cleanPhone = normalizeWaPhone(formData.parentPhone) || formData.parentPhone.trim();
    const studentPayload: Student = editingStudent
      ? {
          ...editingStudent,
          name: formData.name.trim(),
          nis: formData.nis.trim(),
          nisn: formData.nisn.trim(),
          gender: formData.gender,
          studentClass: formData.studentClass.trim(),
          parentName: formData.parentName.trim(),
          parentPhone: cleanPhone,
          address: formData.address.trim(),
          facePhoto: formData.facePhoto || undefined,
          faceDescriptor: formData.faceDescriptor,
          qrCodeData:
            editingStudent.qrCodeData ||
            `SMPN1-${formData.nis.trim()}-${formData.name.trim().toUpperCase().replace(/\s+/g, '_')}`,
        }
      : {
          id: `std-${Date.now()}`,
          name: formData.name.trim(),
          nis: formData.nis.trim(),
          nisn: formData.nisn.trim(),
          gender: formData.gender,
          studentClass: formData.studentClass.trim(),
          parentName: formData.parentName.trim(),
          parentPhone: cleanPhone,
          address: formData.address.trim(),
          facePhoto: formData.facePhoto || undefined,
          faceDescriptor: formData.faceDescriptor,
          qrCodeData: `SMPN1-${formData.nis.trim()}-${formData.name.trim().toUpperCase().replace(/\s+/g, '_')}`,
          status: 'aktif',
        };

    setIsSavingStudent(true);
    try {
      const synced = editingStudent
        ? await Promise.resolve(onUpdateStudent(studentPayload))
        : await Promise.resolve(onAddStudent(studentPayload));

      stopEnrollCamera();
      setIsModalOpen(false);

      if (sheetsStatus.isConfigured) {
        setSyncNotice(
          synced
            ? {
                type: 'ok',
                text: `Siswa "${studentPayload.name}"${studentPayload.facePhoto ? ' + Foto Wajah' : ''} tersimpan otomatis ke Google Spreadsheet (Sheet Siswa).`,
              }
            : {
                type: 'warn',
                text: `Siswa "${studentPayload.name}" disimpan lokal dan masuk antrean sinkronisasi ke Google Spreadsheet.`,
              }
        );
      } else {
        setSyncNotice({
          type: 'ok',
          text: `Siswa "${studentPayload.name}" disimpan di perangkat. Hubungkan URL Google Apps Script di Pengaturan untuk sinkron ke Spreadsheet.`,
        });
      }
      window.setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Nama', 'NIS', 'NISN', 'Kelas', 'JK', 'Wali Murid', 'No WA Ortu', 'Status Wajah', 'Alamat'];
    const rows = filtered.map((s) => [
      s.id,
      `"${s.name}"`,
      `"${s.nis}"`,
      `"${s.nisn}"`,
      `"${s.studentClass}"`,
      s.gender,
      `"${s.parentName}"`,
      `"${s.parentPhone}"`,
      s.faceDescriptor?.length === 128 ? 'Terdaftar' : 'Belum',
      `"${s.address || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_siswa_${selectedClass}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Data Siswa &amp; Foto Wajah Biometrik
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola direktori siswa, daftarkan foto wajah untuk absensi kamera HP, kontak WhatsApp wali murid, dan cetak kartu pelajar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {students.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDeleteAllOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua ({students.length})</span>
            </button>
          )}

          <button
            onClick={() => onOpenCardModal(null)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Kartu Massal</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Siswa Baru</span>
          </button>
        </div>
      </div>

      {/* Live Spreadsheet Integration Status Bar */}
      <div
        className={`px-4 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
          sheetsStatus.isConfigured
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {sheetsStatus.isConfigured ? (
            <CloudCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="font-medium">
            {sheetsStatus.isConfigured
              ? sheetsStatus.pendingCount > 0
                ? `Terhubung ke Google Spreadsheet (${sheetsStatus.pendingCount} data menunggu antrean kirim).`
                : 'Terintegrasi otomatis dengan Google Spreadsheet (Sheet Siswa) — tambah/edit siswa & foto wajah langsung masuk.'
              : 'Belum terhubung ke Google Spreadsheet. Hubungkan URL Apps Script agar data siswa baru otomatis tersimpan ke Sheet.'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sheetsStatus.spreadsheetUrl && (
            <a
              href={sheetsStatus.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Buka Sheet</span>
            </a>
          )}
          {sheetsStatus.isConfigured && onSyncSheetsNow ? (
            <button
              type="button"
              onClick={() => void onSyncSheetsNow()}
              disabled={sheetsStatus.isSyncing}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${sheetsStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span>{sheetsStatus.isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
            </button>
          ) : (
            onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Hubungkan Spreadsheet</span>
              </button>
            )
          )}
        </div>
      </div>

      {syncNotice && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            syncNotice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{syncNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, NIS, atau orang tua..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
            >
              <option value="all">Semua Kelas ({students.length})</option>
              {uniqueClasses.map((c) => (
                <option key={c} value={c}>
                  {c} ({students.filter((s) => s.studentClass === c).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Siswa &amp; Foto Wajah</th>
                <th className="py-3 px-4">NIS / NISN</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Biometrik</th>
                <th className="py-3 px-4">Orang Tua / Wali</th>
                <th className="py-3 px-4">WhatsApp Ortu</th>
                <th className="py-3 px-4 text-center">Kartu ID</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((student) => {
                const hasFace =
                  Array.isArray(student.faceDescriptor) && student.faceDescriptor.length === 128;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {student.facePhoto ? (
                          <img
                            src={student.facePhoto}
                            alt={student.name}
                            className="w-9 h-9 rounded-full object-cover border border-emerald-300 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              student.gender === 'L'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 block">{student.name}</span>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[190px]">
                            {student.address || 'Jakarta Selatan'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                      <div>{student.nis}</div>
                      <div className="text-[10px] text-slate-400">{student.nisn}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {student.studentClass}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {hasFace ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Wajah Siap
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(student)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          Daftar Wajah
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {student.parentName}
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={createWhatsAppUrl(
                          student.parentPhone,
                          `Halo Bapak/Ibu ${student.parentName}, ini adalah pesan uji coba dari Sistem Absensi ${settings.schoolName}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        +{student.parentPhone}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenCardModal(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                          title="Lihat & Cetak Kartu Pelajar"
                        >
                          <ScanFace className="w-3.5 h-3.5 text-slate-600" />
                          <span>Cetak ID</span>
                        </button>

                        {onViewProgress && (
                          <button
                            onClick={() => onViewProgress(student.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                            title="Lihat Rapor Presensi Siswa Ini"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                            <span>Rapor</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(student)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Edit Data & Foto Wajah Siswa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Tidak ditemukan siswa dengan kriteria pencarian tersebut.
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingStudent ? 'Edit Data & Foto Wajah Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                onClick={() => {
                  stopEnrollCamera();
                  setIsModalOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Foto Wajah Biometrik Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start gap-3.5">
                  {formData.facePhoto ? (
                    <img
                      src={formData.facePhoto}
                      alt="Foto Wajah Siswa"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <ScanFace className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">Foto Wajah Biometrik (Scan Absensi)</p>
                      <button
                        type="button"
                        onClick={() => {
                          const next = cameraFacing === 'user' ? 'environment' : 'user';
                          setCameraFacing(next);
                          if (isEnrollCamOpen) void startEnrollCamera(next);
                        }}
                        title="Ganti Kamera Depan / Belakang"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                      >
                        <SwitchCamera className="w-3 h-3" />
                        <span>{cameraFacing === 'user' ? 'Depan' : 'Belakang'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formData.faceDescriptor?.length === 128
                        ? 'Wajah aktif & siap dikenali oleh pemindai kamera HP serta tersimpan ke Spreadsheet.'
                        : 'Ambil lewat Foto Kamera HP, Unggah Foto Wajah, atau Kamera Langsung.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-2xs">
                        {faceDetecting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        <span>{faceDetecting ? 'Mendeteksi...' : 'Foto Kamera HP'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture={cameraFacing}
                          onChange={handleUploadFacePhoto}
                          className="hidden"
                        />
                      </label>

                      <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-2xs">
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Unggah Foto Wajah</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadFacePhoto}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={isEnrollCamOpen ? stopEnrollCamera : () => void startEnrollCamera()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        <ScanFace className="w-3.5 h-3.5" />
                        <span>{isEnrollCamOpen ? 'Tutup Kamera' : 'Kamera Langsung'}</span>
                      </button>

                      {formData.facePhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              facePhoto: '',
                              faceDescriptor: undefined,
                            }));
                            setFaceStatusMsg(null);
                          }}
                          className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-medium cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Always keep <video> mounted in DOM so iOS Safari & Android Chrome attach srcObject synchronously */}
                <div className={isEnrollCamOpen ? 'space-y-2' : 'hidden'}>
                  <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3] min-h-[300px] sm:min-h-[380px] flex items-center justify-center">
                    <video
                      ref={enrollVideoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={captureFromEnrollCamera}
                    disabled={faceDetecting}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{faceDetecting ? 'Mengekstrak Wajah...' : 'Jepret & Simpan Foto Wajah'}</span>
                  </button>
                </div>

                {faceStatusMsg && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex flex-col gap-2 ${
                      faceStatusMsg.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      {faceStatusMsg.type === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      )}
                      <span>{faceStatusMsg.text}</span>
                    </div>
                    {faceStatusMsg.isIframeBlocked && typeof window !== 'undefined' && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Buka Tab Penuh untuk Kamera Langsung</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Muhammad Farhan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NIS (Nomor Induk) *</label>
                  <input
                    type="text"
                    required
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    placeholder="23241001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NISN Nasional</label>
                  <input
                    type="text"
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    placeholder="0071234001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kelas / Rombel</label>
                  <input
                    type="text"
                    required
                    list="student-class-suggestions"
                    value={formData.studentClass}
                    onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                    placeholder="VII A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <datalist id="student-class-suggestions">
                    {uniqueClasses.map((clsName) => (
                      <option key={clsName} value={clsName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Orang Tua / Wali *</label>
                  <input
                    type="text"
                    required
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="Bapak Suryanto"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">No. WhatsApp Ortu *</label>
                  <input
                    type="text"
                    required
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="6281234567890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Format: 628xxxx</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Alamat Tempat Tinggal</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Jl. Melati No. 12, Jakarta"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${sheetsStatus.isConfigured ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span>
                    {sheetsStatus.isConfigured
                      ? 'Terintegrasi Google Spreadsheet — data & foto wajah otomatis dikirim ke Sheet Siswa.'
                      : 'Disimpan lokal dulu. Hubungkan Spreadsheet di Pengaturan untuk sinkronisasi cloud.'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopEnrollCamera();
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSavingStudent
                    ? 'Menyimpan...'
                    : editingStudent
                    ? 'Simpan Perubahan'
                    : sheetsStatus.isConfigured
                    ? 'Simpan & Sinkron ke Sheet'
                    : 'Tambahkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete All Students Modal */}
      {confirmDeleteAllOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Semua Data Siswa?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Seluruh {students.length} data siswa beserta foto wajah biometrik akan dihapus permanen dari aplikasi &amp; Google Spreadsheet.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAllStudents();
                  setConfirmDeleteAllOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Single Student Delete Modal */}
      {confirmDeleteStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Data Siswa?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Hapus data <strong>{confirmDeleteStudent.name}</strong> ({confirmDeleteStudent.studentClass}) dari aplikasi &amp; Google Spreadsheet?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudent(confirmDeleteStudent.id);
                  setConfirmDeleteStudent(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
