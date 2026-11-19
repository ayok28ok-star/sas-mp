import { AttendanceRecord, SchoolSettings, Student } from '../types/attendance';

/**
 * Format any Indonesian phone number to international WhatsApp format (628xxxxxxxx)
 */
export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 08..., replace with 628...
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (cleaned.startsWith('+62')) {
    cleaned = cleaned.substring(1);
  } else if (!cleaned.startsWith('62') && cleaned.length > 5) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function formatIndonesianDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'hadir_tepat':
      return 'Hadir Tepat Waktu';
    case 'terlambat':
      return 'Hadir Terlambat';
    case 'izin':
      return 'Izin';
    case 'sakit':
      return 'Sakit';
    case 'alpa':
      return 'Tidak Hadir / Alpa';
    default:
      return status;
  }
}

export function generateNotificationMessage(
  templateText: string,
  params: {
    student: Student;
    record?: Partial<AttendanceRecord>;
    settings: SchoolSettings;
    notes?: string;
  }
): string {
  const { student, record, settings, notes } = params;
  const now = new Date();
  const timeStr = record?.checkInTime || now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
  const dateStr = record?.date ? formatIndonesianDate(record.date) : formatIndonesianDate(now.toISOString().split('T')[0]);
  const statusStr = record?.status ? getStatusLabel(record.status) : 'Hadir';

  let msg = templateText
    .replace(/{nama_siswa}/g, student.name)
    .replace(/{kelas}/g, student.studentClass)
    .replace(/{nis}/g, student.nis)
    .replace(/{nisn}/g, student.nisn || '-')
    .replace(/{nama_ortu}/g, student.parentName || 'Bapak/Ibu Wali Murid')
    .replace(/{sekolah}/g, settings.schoolName)
    .replace(/{waktu}/g, timeStr)
    .replace(/{tanggal}/g, dateStr)
    .replace(/{status}/g, statusStr)
    .replace(/{catatan}/g, notes || record?.notes || 'Tidak ada catatan');

  return msg;
}

export function createWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppNumber(phone);
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
}
