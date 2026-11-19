import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  UserCheck,
  Clock,
  ExternalLink,
  Smartphone,
  SwitchCamera,
  Flashlight,
  ImagePlus,
  ScanFace,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Sun,
  Moon,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceScope,
  AttendanceType,
  ClassSchedule,
  SchoolSettings,
  Student,
} from '../types/attendance';
import { sounds } from '../utils/audio';
import { createWhatsAppUrl, generateNotificationMessage, getStatusLabel } from '../utils/whatsapp';
import {
  analyzeFrameLighting,
  captureVideoFrameCanvas,
  DetectedFaceResult,
  detectSingleFaceWithDescriptor,
  drawFaceOverlay,
  findBestFaceMatch,
  LightingQualityResult,
  loadFaceModels,
  loadImageFromFile,
} from '../utils/faceRecognition';

interface FaceScannerViewProps {
  students: Student[];
  settings: SchoolSettings;
  todayRecords: AttendanceRecord[];
  onRecordAttendance: (record: AttendanceRecord) => void;
  onUpdateStudent?: (student: Student) => void;
  templates: { [key: string]: string };
  schedules?: ClassSchedule[];
  activeScheduleId?: string | null;
}

export const FaceScannerView: React.FC<FaceScannerViewProps> = ({
  students,
  settings,
  todayRecords,
  onRecordAttendance,
  onUpdateStudent,
  templates,
  schedules = [],
  activeScheduleId,
}) => {
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('masuk');
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>(
    activeScheduleId ? 'mapel' : 'harian'
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    activeScheduleId || schedules[0]?.id || ''
  );

  // Camera & AI Face Recognition state
  const [modelsReady, setModelsReady] = useState<boolean>(false);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [liveStatusText, setLiveStatusText] = useState<string>('Arahkan wajah ke kamera...');
  const [lightingQuality, setLightingQuality] = useState<LightingQualityResult | null>(null);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);

  // Captured / Unmatched face quick-enrollment state
  const [pendingEnrollFace, setPendingEnrollFace] = useState<{
    facePhoto: string;
    descriptor: number[];
    targetStudentId: string;
  } | null>(null);

  const [lastScannedStudent, setLastScannedStudent] = useState<{
    student: Student;
    record: AttendanceRecord;
    message: string;
    confidencePct?: number;
    capturedPhoto?: string;
  } | null>(null);

  // Sync if activeScheduleId passed externally
  useEffect(() => {
    if (activeScheduleId) {
      setAttendanceScope('mapel');
      setSelectedScheduleId(activeScheduleId);
    }
  }, [activeScheduleId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [manualNisInput, setManualNisInput] = useState('');
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopTimerRef = useRef<number | null>(null);
  const lightingTimerRef = useRef<number | null>(null);
  const isDetectingFrameRef = useRef<boolean>(false);
  const isScanningCooldownRef = useRef<boolean>(false);

  // Keep latest props available to async camera loop
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const autoScanRef = useRef(autoScanEnabled);
  autoScanRef.current = autoScanEnabled;

  const currentSchedule = schedules.find((s) => s.id === selectedScheduleId);
  const enrolledCount = students.filter(
    (s) => Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128
  ).length;

  // Preload face-api biometric models on mount
  useEffect(() => {
    let active = true;
    setModelsLoading(true);
    setModelError(null);
    loadFaceModels()
      .then(() => {
        if (!active) return;
        setModelsReady(true);
        setModelsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Face model load error:', err);
        setModelError(
          'Model deteksi wajah gagal dimuat. Pastikan koneksi tersedia saat pertama kali memuat atau gunakan Input NIS Manual.'
        );
        setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Record attendance for a matched or selected student
  const recordStudentAttendance = (
    student: Student,
    options?: { confidencePct?: number; capturedPhoto?: string }
  ) => {
    if (isScanningCooldownRef.current) return;
    isScanningCooldownRef.current = true;
    setTimeout(() => {
      isScanningCooldownRef.current = false;
    }, 2200);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const existing = todayRecords.find((r) => r.studentId === student.id && r.date === dateStr);

    if (attendanceType === 'pulang') {
      if (!existing) {
        sounds.playWarning();
        setScannerMessage(`${student.name} belum tercatat absen masuk hari ini.`);
        return;
      }
      const updatedRecord: AttendanceRecord = {
        ...existing,
        checkOutTime: timeStr,
        whatsappNotification: {
          ...existing.whatsappNotification,
          sent: true,
          status: 'terkirim',
        },
      };

      const pulTemplate =
        templates['pulang'] ||
        `Siswa {nama_siswa} ({kelas}) telah pulang pada pukul {waktu}. Terima kasih.`;
      const message = generateNotificationMessage(pulTemplate, {
        student,
        record: updatedRecord,
        settings,
      });

      sounds.playSuccess();
      onRecordAttendance(updatedRecord);
      setLastScannedStudent({
        student,
        record: updatedRecord,
        message,
        confidencePct: options?.confidencePct,
        capturedPhoto: options?.capturedPhoto || student.facePhoto,
      });
      setScannerMessage(null);
      return;
    }

    if (existing && existing.checkInTime && attendanceScope === 'harian') {
      sounds.playWarning();
      setScannerMessage(
        `${student.name} sudah melakukan absensi masuk hari ini pada pukul ${existing.checkInTime}.`
      );
      return;
    }

    const [hours, minutes] = [now.getHours(), now.getMinutes()];
    const currentTimeMinutes = hours * 60 + minutes;

    const [deadlineH, deadlineM] = (settings.checkInLateTolerance || '07:15')
      .split(':')
      .map(Number);
    const deadlineMinutes = deadlineH * 60 + deadlineM;

    const isLate = currentTimeMinutes > deadlineMinutes;
    const status = isLate ? 'terlambat' : 'hadir_tepat';

    const isSubjectMode = attendanceScope === 'mapel' && currentSchedule;
    const faceNoteSuffix = options?.confidencePct
      ? ` · Verifikasi Wajah ${options.confidencePct}%`
      : '';
    const sessionNote = isSubjectMode
      ? `Sesi ${currentSchedule.subjectName} (${currentSchedule.className} - Guru: ${currentSchedule.teacherName})${faceNoteSuffix}`
      : isLate
      ? `Tiba setelah batas waktu ${settings.checkInLateTolerance}${faceNoteSuffix}`
      : `Tepat waktu${faceNoteSuffix}`;

    const newRecord: AttendanceRecord = {
      id: `rec-${dateStr}-${student.id}-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      studentNis: student.nis,
      studentClass: student.studentClass,
      parentPhone: student.parentPhone,
      parentName: student.parentName,
      date: dateStr,
      checkInTime: timeStr,
      status,
      type: 'masuk',
      attendanceScope,
      subjectId: currentSchedule?.subjectId,
      subjectName: currentSchedule?.subjectName,
      scheduleId: currentSchedule?.id,
      notes: sessionNote,
      whatsappNotification: {
        sent: settings.autoSendWhatsApp,
        sentAt: `${dateStr} ${timeStr}`,
        status: 'terkirim',
        phone: student.parentPhone,
        message: '',
      },
    };

    const templateText =
      status === 'hadir_tepat'
        ? templates['masuk_tepat'] || 'Siswa {nama_siswa} hadir tepat waktu pada {waktu}.'
        : templates['masuk_terlambat'] || 'Siswa {nama_siswa} hadir terlambat pada {waktu}.';

    const finalMessage = generateNotificationMessage(templateText, {
      student,
      record: newRecord,
      settings,
      notes: newRecord.notes,
    });

    newRecord.whatsappNotification.message = finalMessage;

    if (status === 'hadir_tepat') {
      sounds.playSuccess();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } else {
      sounds.playWarning();
    }

    onRecordAttendance(newRecord);
    setLastScannedStudent({
      student,
      record: newRecord,
      message: finalMessage,
      confidencePct: options?.confidencePct,
      capturedPhoto: options?.capturedPhoto || student.facePhoto,
    });
    setScannerMessage(null);
  };

  // Manual NIS lookup
  const handleManualLookup = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    const student = students.find(
      (s) =>
        s.nis === trimmed ||
        s.nisn === trimmed ||
        s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (!student) {
      sounds.playError();
      setScannerMessage(`NIS / Nama "${trimmed}" tidak ditemukan dalam database siswa.`);
      return;
    }
    recordStudentAttendance(student);
  };

  // Process a detected face result (either from live snapshot or uploaded phone photo)
  const handleDetectedFace = (
    detected: DetectedFaceResult | null,
    photoLighting?: LightingQualityResult | null
  ) => {
    if (!detected) {
      sounds.playError();
      if (photoLighting?.level === 'dark') {
        setScannerMessage(
          `Wajah tidak terdeteksi karena pencahayaan terlalu gelap (Kualitas Cahaya ${photoLighting.scorePct}%). Pindah ke area lebih terang atau nyalakan senter HP lalu coba lagi.`
        );
      } else if (photoLighting?.level === 'bright') {
        setScannerMessage(
          `Wajah tidak terdeteksi karena pencahayaan terlalu silau (${photoLighting.scorePct}%). Hindari sorotan lampu langsung dan coba lagi.`
        );
      } else {
        setScannerMessage(
          'Wajah tidak terdeteksi pada foto. Pastikan pencahayaan cukup, wajah menghadap kamera, dan tidak buram.'
        );
      }
      return;
    }

    const match = findBestFaceMatch(detected.descriptor, studentsRef.current, 0.52);
    if (match) {
      setPendingEnrollFace(null);
      recordStudentAttendance(match.student, {
        confidencePct: match.confidencePct,
        capturedPhoto: detected.facePhoto,
      });
    } else {
      sounds.playWarning();
      const defaultTarget =
        studentsRef.current.find(
          (s) => !Array.isArray(s.faceDescriptor) || s.faceDescriptor.length !== 128
        )?.id ||
        studentsRef.current[0]?.id ||
        '';
      setPendingEnrollFace({
        facePhoto: detected.facePhoto,
        descriptor: detected.descriptor,
        targetStudentId: defaultTarget,
      });
      setScannerMessage(
        enrolledCount === 0
          ? 'Wajah terdeteksi! Belum ada foto wajah siswa terdaftar — silakan pilih nama siswa di bawah untuk mendaftarkan wajah & langsung absen.'
          : 'Wajah terdeteksi, namun belum cocok dengan data wajah siswa terdaftar. Anda dapat mendaftarkan wajah ini ke siswa di bawah.'
      );
    }
  };

  // Stop live camera & detection loop
  const stopCamera = () => {
    if (scanLoopTimerRef.current !== null) {
      window.clearTimeout(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    if (lightingTimerRef.current !== null) {
      window.clearInterval(lightingTimerRef.current);
      lightingTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setIsCameraActive(false);
    setHasTorch(false);
    setIsTorchOn(false);
    setLightingQuality(null);
    setLiveStatusText('Kamera dimatikan');
  };

  // Real-time lighting quality sampler (~350ms) so students get immediate brightness feedback
  const startLightingMonitor = () => {
    if (lightingTimerRef.current !== null) {
      window.clearInterval(lightingTimerRef.current);
      lightingTimerRef.current = null;
    }

    const measure = () => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;
      const result = analyzeFrameLighting(video);
      if (result) {
        setLightingQuality((prev) => {
          if (
            prev &&
            prev.level === result.level &&
            Math.abs(prev.scorePct - result.scorePct) < 2
          ) {
            return prev;
          }
          return result;
        });
      }
    };

    measure();
    lightingTimerRef.current = window.setInterval(measure, 350);
  };

  // Continuous lightweight detection loop while live camera is open
  const scheduleNextFrame = () => {
    if (!streamRef.current) return;
    scanLoopTimerRef.current = window.setTimeout(async () => {
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (!video || !canvas || !streamRef.current) return;

      if (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        !isDetectingFrameRef.current
      ) {
        isDetectingFrameRef.current = true;
        try {
          const detected = await detectSingleFaceWithDescriptor(video);
          if (!streamRef.current) return;

          if (detected) {
            const match = findBestFaceMatch(detected.descriptor, studentsRef.current, 0.52);
            if (match) {
              const label = `${match.student.name.split(' ')[0]} (${match.confidencePct}%)`;
              drawFaceOverlay(canvas, video, detected, label, true);
              setLiveStatusText(`Wajah cocok: ${match.student.name} (${match.confidencePct}%)`);
              if (autoScanRef.current && !isScanningCooldownRef.current) {
                recordStudentAttendance(match.student, {
                  confidencePct: match.confidencePct,
                  capturedPhoto: detected.facePhoto,
                });
              }
            } else {
              drawFaceOverlay(canvas, video, detected, 'Wajah Belum Terdaftar', false);
              setLiveStatusText('Wajah terdeteksi — belum terdaftar di database');
            }
          } else {
            drawFaceOverlay(canvas, video, null);
            setLiveStatusText('Arahkan wajah siswa ke dalam bingkai kamera...');
          }
        } catch {
          // ignore transient frame error
        } finally {
          isDetectingFrameRef.current = false;
        }
      }

      if (streamRef.current) {
        scheduleNextFrame();
      }
    }, 550);
  };

  const isCameraPermissionError = (err: unknown): boolean => {
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name?: string }).name || '')
        : '';
    const msg = err instanceof Error ? err.message : String(err || '');
    const combined = `${name} ${msg}`.toLowerCase();
    return (
      combined.includes('notallowederror') ||
      combined.includes('permissiondeniederror') ||
      combined.includes('permission denied') ||
      combined.includes('permission dismissed') ||
      combined.includes('denied') ||
      combined.includes('securityerror')
    );
  };

  // Start Smartphone / Device Camera (request getUserMedia immediately while user gesture is active)
  const startCamera = async (facingOverride?: 'user' | 'environment') => {
    const targetFacing = facingOverride || cameraFacing;
    setCameraError(null);
    setCameraPermissionDenied(false);
    setScannerMessage(null);
    setHasTorch(false);
    setIsTorchOn(false);
    setLiveStatusText('Membuka kamera perangkat...');

    try {
      // Stop only active tracks/timers synchronously without resetting UI state before getUserMedia,
      // so iOS Safari and Chrome Mobile strictly keep the tap user-activation gesture intact.
      if (scanLoopTimerRef.current !== null) {
        window.clearTimeout(scanLoopTimerRef.current);
        scanLoopTimerRef.current = null;
      }
      if (lightingTimerRef.current !== null) {
        window.clearInterval(lightingTimerRef.current);
        lightingTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung (getUserMedia).');
      }

      // 1. Trigger getUserMedia synchronously first; do NOT retry on Permission denied
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
      } catch (firstErr: unknown) {
        if (isCameraPermissionError(firstErr)) {
          throw firstErr;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch (secondErr: unknown) {
          if (isCameraPermissionError(secondErr)) {
            throw secondErr;
          }
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      streamRef.current = stream;
      setCameraFacing(targetFacing);
      setCameraPermissionDenied(false);
      setIsCameraActive(true);

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.muted = true;
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
      }

      startLightingMonitor();

      // Check torch support on rear camera
      try {
        const videoTrack = stream.getVideoTracks()[0];
        const caps = videoTrack?.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        if (caps && caps.torch) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }

      setLiveStatusText('Kamera aktif — menyiapkan pengenalan wajah...');
      await loadFaceModels();
      if (!streamRef.current) return;
      setModelsReady(true);
      setModelsLoading(false);
      setLiveStatusText('Kamera aktif — mendeteksi wajah...');
      scheduleNextFrame();
    } catch (err: unknown) {
      console.error('Face camera start error', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch {
        isInIframe = true;
      }

      let permDenied = isCameraPermissionError(err);
      if (!permDenied && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });
          if (status.state === 'denied') {
            permDenied = true;
          }
        } catch {
          // Permissions API for camera not supported on Safari/older browsers
        }
      }

      setCameraPermissionDenied(permDenied);
      setCameraError(
        isInIframe
          ? `Kamera langsung dibatasi pada tampilan iframe / pratinjau (${errMsg}). Buka di tab browser penuh atau gunakan tombol "Kamera Foto HP" yang langsung membuka kamera bawaan HP.`
          : permDenied
          ? `Izin kamera langsung ditolak browser (${errMsg}). Anda tetap dapat langsung absen menggunakan tombol "Kamera Foto HP" di bawah, atau aktifkan kembali izin Kamera di pengaturan situs browser HP.`
          : `Kamera langsung tidak dapat dimulai (${errMsg}). Gunakan tombol "Kamera Foto HP" atau "Pilih dari Galeri" di bawah.`
      );
      stopCamera();
    }
  };

  const handleToggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      await startCamera(nextFacing);
    }
  };

  const handleToggleTorch = async () => {
    if (!streamRef.current || !isCameraActive || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const next = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setIsTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  };

  // Manual 1-tap snapshot from live video feed
  const handleManualSnapshotScan = async () => {
    const video = videoRef.current;
    if (!video || !isCameraActive || video.readyState < 2 || video.videoWidth === 0) return;
    setIsProcessingPhoto(true);
    setScannerMessage(null);
    try {
      const frameCanvas = captureVideoFrameCanvas(video);
      const sourceForScan = frameCanvas || video;
      const frameLighting = analyzeFrameLighting(sourceForScan) || lightingQuality;
      const detected = await detectSingleFaceWithDescriptor(sourceForScan);
      handleDetectedFace(detected, frameLighting);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sounds.playError();
      setScannerMessage(`Gagal memproses foto wajah: ${msg}`);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Native Smartphone Camera Photo Capture / Image Face Scan
  const handleSmartphonePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    setScannerMessage(null);
    setIsProcessingPhoto(true);

    try {
      if (isCameraActive) {
        stopCamera();
      }
      const img = await loadImageFromFile(file);
      const photoLighting = analyzeFrameLighting(img);
      const detected = await detectSingleFaceWithDescriptor(img);
      handleDetectedFace(detected, photoLighting);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sounds.playError();
      setScannerMessage(
        `Foto wajah tidak dapat diproses (${msg}). Pastikan foto jelas menghadap kamera dan coba lagi.`
      );
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  // Enroll captured face directly to chosen student and record attendance
  const handleQuickEnrollAndAttend = () => {
    if (!pendingEnrollFace || !pendingEnrollFace.targetStudentId) return;
    const student = students.find((s) => s.id === pendingEnrollFace.targetStudentId);
    if (!student) return;

    const updatedStudent: Student = {
      ...student,
      facePhoto: pendingEnrollFace.facePhoto,
      faceDescriptor: pendingEnrollFace.descriptor,
    };

    if (onUpdateStudent) {
      onUpdateStudent(updatedStudent);
    }
    setPendingEnrollFace(null);
    setScannerMessage(null);
    recordStudentAttendance(updatedStudent, {
      confidencePct: 99,
      capturedPhoto: updatedStudent.facePhoto,
    });
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nis.includes(searchQuery) ||
      s.studentClass.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Attendance Mode & Scope Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Pemindaian Foto Wajah Siswa (Kamera HP)
              </h1>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {enrolledCount}/{students.length} Wajah Terdaftar
              </span>
              {attendanceScope === 'mapel' && currentSchedule && (
                <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                  Sesi: {currentSchedule.subjectName} ({currentSchedule.className})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Arahkan kamera depan/belakang HP ke wajah siswa atau ambil foto wajah secara langsung untuk mencatat kehadiran.
            </p>
          </div>

          {/* Mode Selector (Masuk vs Pulang) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setAttendanceType('masuk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                attendanceType === 'masuk'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Absen Masuk</span>
            </button>
            <button
              onClick={() => setAttendanceType('pulang')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                attendanceType === 'pulang'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Absen Pulang</span>
            </button>
          </div>
        </div>

        {/* Scope Selector: Gerbang Harian vs Sesi Mapel */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium">Lingkup Presensi:</span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                onClick={() => setAttendanceScope('harian')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  attendanceScope === 'harian'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gerbang Sekolah (Harian)
              </button>
              <button
                onClick={() => setAttendanceScope('mapel')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  attendanceScope === 'mapel'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sesi Mata Pelajaran
              </button>
            </div>
          </div>

          {attendanceScope === 'mapel' && schedules.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Pilih Sesi Mapel:</span>
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-xs"
              >
                {schedules.map((sch) => (
                  <option key={sch.id} value={sch.id}>
                    {sch.dayOfWeek} · {sch.subjectName} ({sch.className} - {sch.startTime})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Smartphone Face Scanner Left (Enlarged), Live Result & Simulator Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Mobile Face Camera Scanner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScanFace className="w-5 h-5 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Scanner Foto Wajah</h2>
                  <p className="text-[11px] text-slate-500">
                    {modelsLoading
                      ? 'Memuat model biometrik wajah...'
                      : modelsReady
                      ? cameraFacing === 'user'
                        ? 'Kamera Depan (Selfie)'
                        : 'Kamera Belakang Aktif'
                      : 'Mode Foto / NIS'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  title="Ganti Kamera Depan / Belakang"
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>

                {hasTorch && isCameraActive && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    title={isTorchOn ? 'Matikan Senter HP' : 'Nyalakan Senter HP'}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      isTorchOn
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={isCameraActive ? stopCamera : () => startCamera()}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    isCameraActive
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Matikan</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>Buka Kamera</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Video + Face Overlay Viewport (Enlarged frame for clear face scanning) */}
            <div
              className={`relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-[4/3] min-h-[400px] sm:min-h-[480px] lg:min-h-[540px] flex items-center justify-center border transition-all duration-300 ${
                isCameraActive && lightingQuality?.level === 'dark'
                  ? 'border-rose-500 ring-2 ring-rose-500/60'
                  : isCameraActive && lightingQuality?.level === 'dim'
                  ? 'border-amber-400'
                  : isCameraActive && lightingQuality?.level === 'bright'
                  ? 'border-amber-400'
                  : isCameraActive && lightingQuality?.level === 'good'
                  ? 'border-emerald-500/70'
                  : 'border-slate-800'
              }`}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-contain transition-opacity ${
                  isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
              <canvas
                ref={overlayCanvasRef}
                className={`pointer-events-none absolute inset-0 w-full h-full object-contain ${
                  isCameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Subtle centered face-guide reticle so students can position face clearly */}
              {isCameraActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-56 h-72 sm:w-64 sm:h-80 rounded-[44%] border-2 border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(15,23,42,0.12)]" />
                </div>
              )}

              {/* Real-time Lighting Quality HUD (Top Overlay) */}
              {isCameraActive && lightingQuality && (
                <div className="absolute top-2.5 left-2.5 right-2.5 z-10 pointer-events-none">
                  <div
                    className={`rounded-xl px-3 py-2 backdrop-blur-xs border shadow-sm transition-colors duration-300 ${
                      lightingQuality.level === 'dark'
                        ? 'bg-rose-950/85 border-rose-400/60 text-white'
                        : lightingQuality.level === 'dim' || lightingQuality.level === 'bright'
                        ? 'bg-amber-950/80 border-amber-400/50 text-white'
                        : 'bg-slate-950/75 border-emerald-400/40 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {lightingQuality.level === 'dark' ? (
                          <Moon className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                        ) : (
                          <Sun
                            className={`w-3.5 h-3.5 shrink-0 ${
                              lightingQuality.level === 'good' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          />
                        )}
                        <span>Kualitas Cahaya</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            lightingQuality.level === 'dark'
                              ? 'bg-rose-500 text-white'
                              : lightingQuality.level === 'dim' || lightingQuality.level === 'bright'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {lightingQuality.label}
                        </span>
                        <span className="font-mono font-bold text-[10px] text-white/90">
                          {lightingQuality.scorePct}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          lightingQuality.level === 'dark'
                            ? 'bg-rose-500'
                            : lightingQuality.level === 'dim' || lightingQuality.level === 'bright'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${lightingQuality.scorePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Prominent Real-time Warning Banner when Too Dark */}
              {isCameraActive && lightingQuality?.level === 'dark' && (
                <div className="absolute bottom-13 left-3 right-3 z-10">
                  <div className="rounded-xl bg-rose-950/92 border border-rose-400/70 backdrop-blur-xs p-2.5 text-white shadow-lg flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="text-[11px] leading-snug">
                        <p className="font-bold text-rose-200">Pencahayaan Terlalu Gelap!</p>
                        <p className="text-rose-100/90 mt-0.5">
                          Pindah ke area lebih terang atau hadapkan wajah ke sumber cahaya agar wajah terbaca.
                        </p>
                      </div>
                    </div>
                    {hasTorch && !isTorchOn && (
                      <button
                        type="button"
                        onClick={handleToggleTorch}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <Flashlight className="w-3 h-3" />
                        <span>Senter</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-slate-300">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 border ${
                      cameraError
                        ? 'bg-rose-950/90 text-rose-400 border-rose-700/70'
                        : 'bg-slate-800/90 text-emerald-400 border-slate-700'
                    }`}
                  >
                    {cameraError ? (
                      <ShieldAlert className="w-7 h-7" />
                    ) : (
                      <ScanFace className="w-7 h-7" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {cameraError
                      ? cameraPermissionDenied
                        ? 'Izin Kamera Langsung Ditolak'
                        : 'Kamera Langsung Belum Aktif'
                      : 'Siap Scan Wajah via HP'}
                  </p>
                  <p className="text-xs text-slate-300/90 mt-1 max-w-xs leading-relaxed">
                    {cameraError
                      ? 'Gunakan tombol "Kamera Foto HP" di bawah untuk langsung memotret wajah siswa tanpa perlu izin live stream.'
                      : 'Buka kamera HP untuk deteksi wajah langsung atau ambil foto wajah siswa.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <label className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-all">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isProcessingPhoto ? 'Memproses...' : 'Kamera Foto HP'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture={cameraFacing}
                        onChange={handleSmartphonePhotoScan}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacing)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{cameraError ? 'Coba Minta Izin Lagi' : 'Kamera Wajah Langsung'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Live detection status pill */}
              {isCameraActive && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-950/75 backdrop-blur-xs text-[11px] text-white border border-white/10">
                  <span className="truncate">{liveStatusText}</span>
                  <button
                    type="button"
                    onClick={() => setAutoScanEnabled((prev) => !prev)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 cursor-pointer ${
                      autoScanEnabled
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {autoScanEnabled ? 'Auto: ON' : 'Auto: OFF'}
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Lighting Guidance Strip below viewport */}
            {isCameraActive && lightingQuality && (
              <div
                className={`px-3 py-2 rounded-xl border text-[11px] flex items-center gap-2 transition-colors ${
                  lightingQuality.level === 'dark'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : lightingQuality.level === 'dim' || lightingQuality.level === 'bright'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {lightingQuality.level === 'dark' ? (
                  <Moon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                ) : (
                  <Sun
                    className={`w-3.5 h-3.5 shrink-0 ${
                      lightingQuality.level === 'good' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  />
                )}
                <span className="font-medium">{lightingQuality.guidance}</span>
              </div>
            )}

            {/* Active camera manual snapshot CTA + Native Photo Camera & Gallery */}
            <div className="flex flex-col gap-2">
              {isCameraActive && (
                <button
                  type="button"
                  onClick={handleManualSnapshotScan}
                  disabled={isProcessingPhoto}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  <ScanFace className="w-4 h-4 text-emerald-400" />
                  <span>{isProcessingPhoto ? 'Mendeteksi...' : 'Jepret & Cocokkan Wajah'}</span>
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                  {isProcessingPhoto ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengenali Wajah...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Kamera Foto HP</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture={cameraFacing}
                    onChange={handleSmartphonePhotoScan}
                    className="sr-only"
                  />
                </label>

                <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                  <ImagePlus className="w-4 h-4 text-slate-600" />
                  <span>Pilih dari Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSmartphonePhotoScan}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Quick Enrollment Card for Newly Scanned Unknown Face */}
            {pendingEnrollFace && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={pendingEnrollFace.facePhoto}
                    alt="Wajah terdeteksi"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-blue-300 shrink-0"
                  />
                  <div>
                    <p className="font-bold text-blue-950 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                      <span>Daftarkan Wajah Ini ke Siswa</span>
                    </p>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Pilih nama siswa agar foto wajah ini tersimpan permanen untuk scan berikutnya.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={pendingEnrollFace.targetStudentId}
                    onChange={(e) =>
                      setPendingEnrollFace({
                        ...pendingEnrollFace,
                        targetStudentId: e.target.value,
                      })
                    }
                    className="flex-1 px-2.5 py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.studentClass} - {st.nis})
                        {st.faceDescriptor?.length === 128 ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleQuickEnrollAndAttend}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Simpan Wajah &amp; Absen
                  </button>
                </div>
              </div>
            )}

            {modelError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{modelError}</p>
              </div>
            )}

            {cameraError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-semibold text-rose-900">{cameraError}</p>
                    {cameraPermissionDenied && (
                      <div className="text-[11px] text-rose-800/95 bg-white/80 border border-rose-200/80 rounded-lg p-2.5 space-y-1">
                        <p className="font-bold text-rose-900">Cara Mengaktifkan Izin Kamera di HP:</p>
                        <p>
                          • <span className="font-semibold">Chrome Android:</span> Ketuk ikon{' '}
                          <span className="font-semibold">Gembok / Pengaturan</span> di sebelah kiri alamat web &rarr;{' '}
                          <span className="font-semibold">Izin</span> &rarr; <span className="font-semibold">Kamera</span> &rarr;{' '}
                          <span className="font-semibold">Izinkan</span>, lalu ketuk &ldquo;Coba Minta Izin Lagi&rdquo;.
                        </p>
                        <p>
                          • <span className="font-semibold">Safari iPhone/iPad:</span> Ketuk ikon{' '}
                          <span className="font-semibold">aA / Pengaturan</span> di bilah alamat &rarr;{' '}
                          <span className="font-semibold">Pengaturan Situs Web</span> &rarr;{' '}
                          <span className="font-semibold">Kamera</span> &rarr; <span className="font-semibold">Izinkan</span>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera Foto HP</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture={cameraFacing}
                      onChange={handleSmartphonePhotoScan}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => startCamera(cameraFacing)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Minta Izin Lagi</span>
                  </button>
                  {typeof window !== 'undefined' && (() => {
                    try {
                      return window.self !== window.top;
                    } catch {
                      return true;
                    }
                  })() && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Tab Browser Chrome / Safari Penuh</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {scannerMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{scannerMessage}</p>
              </div>
            )}

            {/* Manual NIS fallback */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Atau Ketik NIS / Nama Siswa Manual:
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualNisInput) {
                    handleManualLookup(manualNisInput);
                    setManualNisInput('');
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Contoh: 23241001..."
                  value={manualNisInput}
                  onChange={(e) => setManualNisInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Proses
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Latest Scan Result & Enrolled Faces / Quick Simulator */}
        <div className="lg:col-span-5 space-y-4">
          {lastScannedStudent ? (
            <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  {lastScannedStudent.capturedPhoto ? (
                    <img
                      src={lastScannedStudent.capturedPhoto}
                      alt={lastScannedStudent.student.name}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-300 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900">
                        Presensi Wajah Berhasil Dicatat!
                      </h3>
                      {lastScannedStudent.confidencePct && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" />
                          Kecocokan {lastScannedStudent.confidencePct}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Tercatat pada {lastScannedStudent.record.checkInTime} WIB
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    lastScannedStudent.record.status === 'hadir_tepat'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {getStatusLabel(lastScannedStudent.record.status)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Nama Lengkap Siswa</span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                    {lastScannedStudent.student.name}
                  </span>
                  <span className="text-slate-500 mt-1 block">
                    NIS: {lastScannedStudent.student.nis} · {lastScannedStudent.student.studentClass}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Orang Tua / Wali</span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                    {lastScannedStudent.student.parentName}
                  </span>
                  <span className="text-emerald-700 font-mono mt-1 block">
                    WA: +{lastScannedStudent.student.parentPhone}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Status Notifikasi WA</span>
                  <span className="font-semibold text-emerald-700 text-sm mt-0.5 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    Siap Terkirim
                  </span>
                  <span className="text-slate-500 mt-1 block">Otomatis via Gateway</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  <span>Pesan resmi kehadiran telah digenerate sesuai format sekolah.</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={createWhatsAppUrl(
                      lastScannedStudent.student.parentPhone,
                      lastScannedStudent.message
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Langsung via WA Web</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(lastScannedStudent.message);
                      setCopiedMsg(true);
                      setTimeout(() => setCopiedMsg(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copiedMsg ? 'Tersalin!' : 'Salin Teks'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mt-3">
                Menunggu Pemindaian Foto Wajah
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Daftarkan foto wajah siswa pada menu Data Siswa (atau langsung dari hasil foto di scanner), lalu scan wajah menggunakan kamera HP untuk absensi otomatis.
              </p>
            </div>
          )}

          {/* Quick Tap / Face Enrollment Status List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Status Biometrik Wajah &amp; Simulator Absensi Cepat
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik siswa di bawah untuk simulasi presensi instan atau pantau kelengkapan foto wajah
                </p>
              </div>

              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama/NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
              {filteredStudents.map((s) => {
                const todayRec = todayRecords.find((r) => r.studentId === s.id);
                const hasScanned = !!todayRec?.checkInTime;
                const hasFace = Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128;

                return (
                  <button
                    key={s.id}
                    onClick={() => recordStudentAttendance(s)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      hasScanned
                        ? 'bg-slate-50 border-slate-200 opacity-75 hover:opacity-100'
                        : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {s.facePhoto ? (
                        <img
                          src={s.facePhoto}
                          alt={s.name}
                          className="w-9 h-9 rounded-lg object-cover border border-emerald-300 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            s.gender === 'L'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {s.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-900 block truncate">
                          {s.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{s.studentClass}</span>
                          <span>·</span>
                          <span
                            className={
                              hasFace ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                            }
                          >
                            {hasFace ? 'Wajah Siap' : 'Belum Foto'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      {hasScanned ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            todayRec?.status === 'hadir_tepat'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {todayRec?.checkInTime}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 hover:bg-emerald-600 hover:text-white transition-colors">
                          Absen
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
