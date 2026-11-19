import { AttendanceRecord, NotificationLog, SchoolSettings, Student, WhatsAppTemplate } from '../types/attendance';
import defaultSchoolLogo from '../assets/images/logo_sekolah_resmi_1794851467785.jpg';

export const DEFAULT_SCHOOL_LOGO = defaultSchoolLogo;

export const defaultSchoolSettings: SchoolSettings = {
  schoolName: 'SMP Negeri 1 Nusantara Mandiri',
  npsn: '20108842',
  address: 'Jl. Merdeka Pendidikan No. 45, Kebayoran Baru, Jakarta Selatan',
  principalName: 'Drs. H. Bambang Sudirman, M.Pd.',
  principalNip: '19740512 199903 1 002',
  academicYear: '2026/2027',
  semester: 'Ganjil',
  checkInStartTime: '06:30',
  checkInDeadline: '07:00',
  checkInLateTolerance: '07:15',
  checkOutStartTime: '15:00',
  autoSendWhatsApp: true,
  whatsappGatewayMode: 'direct_web',
  schoolContactPhone: '628118899001',
  botSenderName: 'Sistem Absensi Otomatis SMPN 1 Nusantara',
  defaultThemeId: 'theme-emerald',
  schoolLogo: defaultSchoolLogo,
};

export const defaultWhatsAppTemplates: WhatsAppTemplate[] = [
  {
    id: 'tmpl-1',
    type: 'masuk_tepat',
    title: 'Kehadiran Tepat Waktu (Masuk)',
    text: `*NOTIFIKASI KEHADIRAN SISWA*
{sekolah}
----------------------------------------
Yth. Bapak/Ibu {nama_ortu},

Memberitahukan bahwa putra/putri Anda:
👤 *Nama:* {nama_siswa}
🏫 *Kelas:* {kelas}
🔢 *NIS:* {nis}

Telah hadir di sekolah pada:
📅 *Hari/Tanggal:* {tanggal}
⏰ *Waktu:* {waktu}
✅ *Status:* HADIR TEPAT WAKTU

Terima kasih atas disiplin dan dukungan Bapak/Ibu dalam mendidik putra-putri tercinta.

_Pesan otomatis dikirim melalui Sistem Absensi SMPN 1 Nusantara._`,
  },
  {
    id: 'tmpl-2',
    type: 'masuk_terlambat',
    title: 'Kehadiran Terlambat (Masuk)',
    text: `*PEMBERITAHUAN KETERLAMBATAN SISWA*
{sekolah}
----------------------------------------
Yth. Bapak/Ibu {nama_ortu},

Memberitahukan bahwa putra/putri Anda:
👤 *Nama:* {nama_siswa}
🏫 *Kelas:* {kelas}
🔢 *NIS:* {nis}

Telah tiba di sekolah pada:
📅 *Hari/Tanggal:* {tanggal}
⏰ *Waktu:* {waktu}
⚠️ *Status:* TERLAMBAT (Batas waktu: 07:15 WIB)
📝 *Catatan:* {catatan}

Mohon bantuan Bapak/Ibu untuk memotivasi ananda agar dapat hadir lebih awal demi kelancaran kegiatan belajar mengajar.

_Pesan otomatis Sistem Absensi SMPN 1 Nusantara._`,
  },
  {
    id: 'tmpl-3',
    type: 'izin_sakit',
    title: 'Konfirmasi Izin / Sakit',
    text: `*KONFIRMASI STATUS IZIN/SAKIT*
{sekolah}
----------------------------------------
Yth. Bapak/Ibu {nama_ortu},

Sekolah telah mencatat permohonan ketidakhadiran putra/putri Anda:
👤 *Nama:* {nama_siswa}
🏫 *Kelas:* {kelas}
📅 *Tanggal:* {tanggal}
📋 *Keterangan:* {status}
📄 *Catatan Sekolah:* {catatan}

Semoga ananda lekas sembuh / urusan keluarga berjalan lancar. Terima kasih atas konfirmasinya.

_Pusat Layanan Kesiswaan {sekolah}._`,
  },
  {
    id: 'tmpl-4',
    type: 'pulang',
    title: 'Kepulangan Siswa (Tap Out)',
    text: `*NOTIFIKASI KEPULANGAN SISWA*
{sekolah}
----------------------------------------
Yth. Bapak/Ibu {nama_ortu},

Memberitahukan bahwa ananda telah melakukan absensi kepulangan:
👤 *Nama:* {nama_siswa}
🏫 *Kelas:* {kelas}
📅 *Hari/Tanggal:* {tanggal}
⏰ *Waktu Pulang:* {waktu}
🎒 *Status:* SELESAI PEMBELAJARAN

Mohon pastikan ananda tiba di rumah dengan selamat. Hati-hati di jalan.

_Pesan otomatis Sistem Absensi SMPN 1 Nusantara._`,
  },
  {
    id: 'tmpl-5',
    type: 'peringatan_alpa',
    title: 'Peringatan Siswa Belum Hadir',
    text: `*PERINGATAN KETIDAKHADIRAN SISWA*
{sekolah}
----------------------------------------
Yth. Bapak/Ibu {nama_ortu},

Hingga pukul {waktu}, data absensi kami mencatat bahwa ananda:
👤 *Nama:* {nama_siswa}
🏫 *Kelas:* {kelas}
🔢 *NIS:* {nis}

*BELUM MELAKUKAN ABSENSI* di gerbang sekolah pada hari ini ({tanggal}).

Apabila ananda berhalangan hadir (sakit/izin) atau sedang dalam perjalanan, mohon segera mengonfirmasi kepada wali kelas.

Terima kasih atas perhatian dan kerja samanya.

_Kesiswaan & Bimbingan Konseling {sekolah}._`,
  },
];

export const defaultStudents: Student[] = [];

export function generateInitialRecords(
  _students: Student[],
  _settings: SchoolSettings
): AttendanceRecord[] {
  return [];
}

export function generateInitialLogs(_records: AttendanceRecord[]): NotificationLog[] {
  return [];
}
