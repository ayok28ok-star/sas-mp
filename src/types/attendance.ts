export type AttendanceStatus = 'hadir_tepat' | 'terlambat' | 'izin' | 'sakit' | 'alpa';

export type AttendanceType = 'masuk' | 'pulang';

export type AttendanceScope = 'harian' | 'mapel';

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  studentClass: string;
  parentName: string;
  parentPhone: string;
  avatarUrl?: string;
  facePhoto?: string;
  faceDescriptor?: number[];
  qrCodeData?: string;
  status: 'aktif' | 'nonaktif';
  address?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  parentPhone: string;
  parentName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  status: AttendanceStatus;
  type: AttendanceType;
  attendanceScope?: AttendanceScope;
  subjectId?: string;
  subjectName?: string;
  scheduleId?: string;
  notes?: string;
  lateMinutes?: number;
  whatsappNotification: {
    sent: boolean;
    sentAt?: string;
    message?: string;
    status: 'terkirim' | 'pending' | 'gagal';
    phone: string;
  };
}

export interface WhatsAppTemplate {
  id: string;
  type: 'masuk_tepat' | 'masuk_terlambat' | 'izin_sakit' | 'pulang' | 'peringatan_alpa' | 'rapor_individu';
  title: string;
  text: string;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "VII A"
  gradeLevel: 'VII' | 'VIII' | 'IX';
  major: 'Reguler' | 'Unggulan' | 'Bilingual' | 'Tahfidz' | 'Khusus' | string;
  roomNumber: string;
  capacity: number;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
}

export interface Subject {
  id: string;
  code: string; // e.g. "MAT-01"
  name: string; // e.g. "Matematika"
  category: 'Wajib' | 'Pilihan' | 'Mulok' | 'Peminatan';
  hoursPerWeek: number;
  color?: string;
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  gender: 'L' | 'P';
  phone: string;
  email: string;
  subjectSpecialties: string[];
  isDutyTeacher?: boolean;
  dutyDays?: ClassSchedule['dayOfWeek'][];
  dutyShift?: string;
}

export interface ClassSchedule {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dutyTeacherId?: string;
  dutyTeacherName?: string;
  dayOfWeek: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  startTime: string; // HH:mm e.g. "07:30"
  endTime: string; // HH:mm e.g. "09:00"
  room: string;
}

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  primary: string; // primary tailwind color class prefix or hex
  primaryClass: string; // e.g. 'bg-emerald-600'
  accentClass: string;
  badgeClass: string;
  gradientClass: string;
  previewColor: string;
}

export interface SchoolSettings {
  schoolName: string;
  npsn: string;
  address: string;
  principalName: string;
  principalNip: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  checkInStartTime: string; // e.g. "06:30"
  checkInDeadline: string; // e.g. "07:00"
  checkInLateTolerance: string; // e.g. "07:15"
  checkOutStartTime: string; // e.g. "15:00"
  autoSendWhatsApp: boolean;
  whatsappGatewayMode: 'direct_web' | 'simulated_api';
  schoolContactPhone: string;
  botSenderName: string;
  defaultThemeId: string;
  schoolLogo?: string;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  studentName: string;
  studentClass: string;
  parentName: string;
  recipientPhone: string;
  messageType: string;
  content: string;
  status: 'terkirim' | 'pending' | 'gagal';
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'Administrator' | 'Guru Piket' | 'Siswa';
}

export interface RegisteredUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'Administrator' | 'Guru Piket' | 'Siswa';
  createdAt: string;
}

