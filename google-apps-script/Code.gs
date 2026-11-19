/**
 * ============================================================================
 * SAS (SISTEM ABSENSI SISWA) — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * Integrasi penuh Google Spreadsheet + Web App (HtmlService)
 *
 * Cara Pemasangan:
 * 1. Buka Google Spreadsheet baru (https://sheets.new).
 * 2. Klik menu: Ekstensi (Extensions) -> Apps Script.
 * 3. Hapus kode bawaan di Code.gs, lalu tempel seluruh isi file ini.
 * 4. Buat file HTML baru bernama "Index" (Index.html), lalu tempel isi Index.html.
 * 5. Simpan proyek (Ctrl+S), jalankan fungsi "initializeDatabase" satu kali
 *    atau muat ulang Spreadsheet lalu gunakan menu "SAS - Sistem Absensi".
 * 6. Klik "Deploy" -> "New deployment" -> pilih "Web app":
 *    - Execute as: Me
 *    - Who has access: Anyone (atau Anyone within domain)
 * 7. Buka URL Web App yang dihasilkan!
 * ============================================================================
 */

var SHEET_NAMES = {
  STUDENTS: 'Siswa',
  RECORDS: 'Absensi',
  CLASSES: 'Kelas',
  SUBJECTS: 'Mapel',
  TEACHERS: 'Guru',
  SCHEDULES: 'Jadwal',
  SETTINGS: 'Pengaturan',
  TEMPLATES: 'TemplateWA',
  LOGS: 'LogNotifikasi',
  USERS: 'Pengguna',
};

var HEADERS = {
  Siswa: ['id', 'nis', 'nisn', 'name', 'gender', 'studentClass', 'parentName', 'parentPhone', 'qrCodeData', 'status', 'address', 'facePhoto', 'faceDescriptor'],
  Absensi: [
    'id', 'studentId', 'studentName', 'studentNis', 'studentClass',
    'parentPhone', 'parentName', 'date', 'checkInTime', 'checkOutTime',
    'status', 'type', 'attendanceScope', 'subjectId', 'subjectName',
    'scheduleId', 'notes', 'lateMinutes', 'waSent', 'waSentAt', 'waStatus', 'waMessage'
  ],
  Kelas: ['id', 'name', 'gradeLevel', 'major', 'roomNumber', 'capacity', 'homeroomTeacherId', 'homeroomTeacherName'],
  Mapel: ['id', 'code', 'name', 'category', 'hoursPerWeek', 'color'],
  Guru: ['id', 'nip', 'name', 'gender', 'phone', 'email', 'subjectSpecialties', 'isDutyTeacher', 'dutyDays', 'dutyShift'],
  Jadwal: ['id', 'classId', 'className', 'subjectId', 'subjectName', 'teacherId', 'teacherName', 'dutyTeacherId', 'dutyTeacherName', 'dayOfWeek', 'startTime', 'endTime', 'room'],
  Pengaturan: ['key', 'value'],
  TemplateWA: ['id', 'type', 'title', 'text'],
  LogNotifikasi: ['id', 'timestamp', 'studentName', 'studentClass', 'parentName', 'recipientPhone', 'messageType', 'content', 'status'],
  Pengguna: ['id', 'username', 'password', 'displayName', 'role', 'createdAt'],
};

var LOGO_PROP_KEY = 'SAS_SCHOOL_LOGO_DATA_URL';
var FAVICON_DATA_PROP_KEY = 'SAS_FAVICON_DATA_URL';
var FAVICON_URL_PROP_KEY = 'SAS_FAVICON_URL';
var FAVICON_FILE_ID_PROP_KEY = 'SAS_FAVICON_DRIVE_FILE_ID';
var SPREADSHEET_ID_PROP_KEY = 'SAS_SPREADSHEET_ID';
var MAX_PROP_CHUNK_LEN = 7500;
var MAX_SHEET_CELL_LEN = 49000;

/**
 * Menu otomatis saat Google Spreadsheet dibuka
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏫 SAS - Sistem Absensi')
      .addItem('🚀 Buka Aplikasi SAS (Layar Penuh)', 'openSasDialog')
      .addSeparator()
      .addItem('⚙️ Inisialisasi Sheet Kosong', 'menuInitializeDatabase')
      .addItem('🗑️ Kosongkan Semua Data Sheet', 'menuResetDatabase')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen dilewati: ' + e);
  }
}

function createIndexHtmlOutput_() {
  try {
    return HtmlService.createHtmlOutputFromFile('Index');
  } catch (e) {
    return HtmlService.createHtmlOutputFromFile('index');
  }
}

/**
 * Membuka aplikasi Web UI langsung di dalam modal Google Sheets
 */
function openSasDialog() {
  ensureAllSheets_(false);
  var html = createIndexHtmlOutput_()
    .setWidth(1280)
    .setHeight(820)
    .setTitle('SAS (Sistem Absensi Siswa)');
  SpreadsheetApp.getUi().showModalDialog(html, 'SAS (Sistem Absensi Siswa)');
}

function isValidGasFaviconUrl_(url) {
  if (!url) return false;
  var str = String(url).trim();
  if (!/^https?:\/\//i.test(str)) return false;
  return /\.(png|ico|gif)(\?.*)?$/i.test(str) || str.indexOf('format=png') !== -1 || str.indexOf('format=ico') !== -1;
}

function getWebAppUrlSafe_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

function readSettingsFastForGet_() {
  var settings = getDefaultSettings_();
  var props = PropertiesService.getScriptProperties();
  var propFavUrl = props.getProperty(FAVICON_URL_PROP_KEY);
  if (propFavUrl !== null) {
    settings.faviconUrl = propFavUrl;
  }
  var propLogo = getChunkedProp_(props, LOGO_PROP_KEY);
  if (propLogo !== null) {
    settings.schoolLogo = propLogo;
  }
  if (isValidGasFaviconUrl_(settings.faviconUrl) || isValidGasFaviconUrl_(settings.schoolLogo)) {
    return settings;
  }
  var ss = getSs_();
  var settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!settingsSheet || settingsSheet.getLastRow() < 2) {
    ensureAllSheets_(false);
  }
  return readSettingsInternal_();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isAuthorizedSyncRequest_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SAS_SYNC_TOKEN');
  if (!expected) return true;
  return String(token || '').trim() === String(expected).trim();
}

/**
 * Entry point Web App GET (HTML UI, Manifest PWA, & JSON API untuk Vercel)
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
  var token = e && e.parameter && e.parameter.token ? String(e.parameter.token) : '';

  if (action === 'ping') {
    if (!isAuthorizedSyncRequest_(token)) {
      return jsonResponse_({ ok: false, error: 'Token sinkronisasi tidak valid.' });
    }
    try {
      ensureAllSheets_(false);
      return jsonResponse_({
        ok: true,
        app: 'SAS-Google-Sheets-API',
        spreadsheetUrl: getSs_().getUrl(),
        webAppUrl: getWebAppUrlSafe_(),
        serverTime: new Date().toISOString(),
      });
    } catch (pingErr) {
      return jsonResponse_({ ok: false, error: String(pingErr && pingErr.message ? pingErr.message : pingErr) });
    }
  }

  if (action === 'bootstrap') {
    if (!isAuthorizedSyncRequest_(token)) {
      return jsonResponse_({ ok: false, error: 'Token sinkronisasi tidak valid.' });
    }
    try {
      return jsonResponse_({
        ok: true,
        data: getBootstrapData(),
        serverTime: new Date().toISOString(),
      });
    } catch (bootErr) {
      return jsonResponse_({ ok: false, error: String(bootErr && bootErr.message ? bootErr.message : bootErr) });
    }
  }

  var settings = getDefaultSettings_();
  try {
    settings = readSettingsFastForGet_();
  } catch (initErr) {
    Logger.log('doGet init warning: ' + initErr);
  }

  if (action === 'manifest') {
    var iconHref = isValidGasFaviconUrl_(settings.faviconUrl)
      ? settings.faviconUrl
      : isValidGasFaviconUrl_(settings.schoolLogo)
      ? settings.schoolLogo
      : '';
    var manifest = {
      id: './',
      name: 'SAS (Sistem Absensi Siswa)',
      short_name: 'SAS Absensi',
      description: 'Aplikasi absensi siswa modern berbasis Scan Foto Wajah, jadwal kelas, rapor PDF resmi, dan notifikasi WhatsApp.',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: '#059669',
      background_color: '#f8fafc',
      start_url: getWebAppUrlSafe_() || './',
      icons: iconHref
        ? [
            { src: iconHref, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: iconHref, sizes: '512x512', type: 'image/png', purpose: 'any' },
          ]
        : [],
    };
    return ContentService.createTextOutput(JSON.stringify(manifest)).setMimeType(ContentService.MimeType.JSON);
  }

  var output = createIndexHtmlOutput_()
    .setTitle('SAS (Sistem Absensi Siswa)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  var favUrl = settings.faviconUrl;
  if (!isValidGasFaviconUrl_(favUrl) && isValidGasFaviconUrl_(settings.schoolLogo)) {
    favUrl = settings.schoolLogo;
  }
  if (isValidGasFaviconUrl_(favUrl)) {
    try {
      output.setFaviconUrl(favUrl);
    } catch (err) {
      Logger.log('setFaviconUrl dilewati: ' + err);
    }
  }
  return output;
}

/**
 * Entry point Web App POST (Menerima sinkronisasi otomatis dari Vercel / PWA)
 */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var action = req && req.action ? String(req.action) : '';
    var payload = (req && req.payload) || {};

    if (!isAuthorizedSyncRequest_(req && req.token)) {
      return jsonResponse_({ ok: false, error: 'Token sinkronisasi tidak valid.' });
    }

    var result = null;
    if (action === 'ping') {
      ensureAllSheets_(false);
      result = {
        app: 'SAS-Google-Sheets-API',
        spreadsheetUrl: getSs_().getUrl(),
        webAppUrl: getWebAppUrlSafe_(),
      };
    } else if (action === 'bootstrap') {
      result = getBootstrapData();
    } else if (action === 'recordAttendance') {
      result = recordAttendance(payload.record || payload);
    } else if (action === 'saveStudent') {
      result = saveStudent(payload.student || payload);
    } else if (action === 'deleteStudent') {
      result = deleteStudent(payload.id);
    } else if (action === 'deleteAllStudents') {
      result = deleteAllStudents();
    } else if (action === 'saveSettings') {
      result = saveSettings(payload.settings || payload);
    } else if (action === 'saveClass') {
      result = saveClass(payload.item || payload);
    } else if (action === 'deleteClass') {
      result = deleteClass(payload.id);
    } else if (action === 'deleteAllClasses') {
      result = deleteAllClasses();
    } else if (action === 'saveSubject') {
      result = saveSubject(payload.item || payload);
    } else if (action === 'deleteSubject') {
      result = deleteSubject(payload.id);
    } else if (action === 'deleteAllSubjects') {
      result = deleteAllSubjects();
    } else if (action === 'saveTeacher') {
      result = saveTeacher(payload.item || payload);
    } else if (action === 'deleteTeacher') {
      result = deleteTeacher(payload.id);
    } else if (action === 'deleteAllTeachers') {
      result = deleteAllTeachers();
    } else if (action === 'clearAllDutyTeachers') {
      result = clearAllDutyTeachers();
    } else if (action === 'saveSchedule') {
      result = saveSchedule(payload.item || payload);
    } else if (action === 'deleteSchedule') {
      result = deleteSchedule(payload.id);
    } else if (action === 'deleteAllSchedules') {
      result = deleteAllSchedules();
    } else if (action === 'deleteStudentRecords') {
      result = deleteStudentRecords(payload.studentId);
    } else if (action === 'deleteRecordsByDate') {
      result = deleteRecordsByDate(payload.date);
    } else if (action === 'deleteAllRecords') {
      result = deleteAllRecords();
    } else if (action === 'saveTemplate') {
      result = saveTemplate(payload.template || payload);
    } else if (action === 'addNotificationLog') {
      result = addNotificationLog(payload.log || payload);
    } else if (action === 'registerUser') {
      result = registerUser(payload.user || payload);
    } else if (action === 'syncAll' || action === 'importBackupJson') {
      var backupStr = typeof payload.backup === 'string'
        ? payload.backup
        : JSON.stringify(payload.backup || payload);
      result = importBackupJson(backupStr);
    } else if (action === 'resetDemoData') {
      result = resetDemoData();
    } else {
      return jsonResponse_({ ok: false, error: 'Aksi API tidak dikenal: ' + action });
    }

    return jsonResponse_({
      ok: true,
      action: action,
      data: result,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

/**
 * Menu helper untuk inisialisasi manual
 */
function menuInitializeDatabase() {
  ensureAllSheets_(false);
  SpreadsheetApp.getUi().alert('Semua sheet SAS berhasil disiapkan tanpa menimpa data yang sudah ada.');
}

function menuResetDatabase() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'Konfirmasi Kosongkan Data',
    'Semua data siswa, absensi, kelas, mapel, guru, guru piket, dan jadwal akan dikosongkan. Lanjutkan?',
    ui.ButtonSet.YES_NO
  );
  if (res === ui.Button.YES) {
    ensureAllSheets_(true);
    ui.alert('Semua sheet data SAS berhasil dikosongkan.');
  }
}

/**
 * Fungsi setup manual yang bisa dijalankan langsung dari editor Apps Script
 */
function initializeDatabase() {
  ensureAllSheets_(false);
}

/**
 * ============================================================================
 * HELPER FORMAT & READ/WRITE GOOGLE SHEETS
 * ============================================================================
 */

function getSs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(SPREADSHEET_ID_PROP_KEY);
  if (savedId) {
    try {
      ss = SpreadsheetApp.openById(savedId);
      if (ss) return ss;
    } catch (e) {
      Logger.log('Gagal membuka spreadsheet tersimpan: ' + e);
    }
  }

  ss = SpreadsheetApp.create('SAS - Database Sistem Absensi');
  props.setProperty(SPREADSHEET_ID_PROP_KEY, ss.getId());
  return ss;
}

function sanitizeCellStr_(val) {
  if (val === undefined || val === null) return '';
  var s = Array.isArray(val) ? val.join(', ') : (typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val));
  if (s.length > MAX_SHEET_CELL_LEN) {
    return s.slice(0, MAX_SHEET_CELL_LEN);
  }
  return s;
}

function formatCellValue_(val, header) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    if (header === 'date') {
      return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
    }
    if (header === 'checkInTime' || header === 'checkOutTime') {
      return Utilities.formatDate(val, tz, 'HH:mm:ss');
    }
    if (header === 'startTime' || header === 'endTime') {
      return Utilities.formatDate(val, tz, 'HH:mm');
    }
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val);
}

function getOrCreateSheet_(name, headers) {
  var ss = getSs_();
  var sheet = ss.getSheetByName(name);
  var isNew = false;

  if (!sheet) {
    sheet = ss.insertSheet(name);
    isNew = true;
  }

  var lastRow = sheet.getLastRow();
  var firstCellEmpty = lastRow === 0 || String(sheet.getRange(1, 1).getValue() || '').trim() === '';
  if (lastRow === 0 || firstCellEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 100), headers.length).setNumberFormat('@');
    isNew = true;
  } else {
    var lastCol = sheet.getLastColumn();
    if (lastCol < headers.length) {
      var missingHeaders = headers.slice(lastCol);
      var extraHeaderRange = sheet.getRange(1, lastCol + 1, 1, missingHeaders.length);
      extraHeaderRange.setValues([missingHeaders]);
      extraHeaderRange.setBackground('#0f172a');
      extraHeaderRange.setFontColor('#ffffff');
      extraHeaderRange.setFontWeight('bold');
      sheet.getRange(2, lastCol + 1, Math.max(sheet.getMaxRows() - 1, 100), missingHeaders.length).setNumberFormat('@');
    }
  }

  return { sheet: sheet, isNew: isNew };
}

function readSheetObjects_(sheetName, headers) {
  var res = getOrCreateSheet_(sheetName, headers);
  var sheet = res.sheet;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var items = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (!row[0] && row[0] !== 0) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = formatCellValue_(row[c], headers[c]);
    }
    items.push(obj);
  }
  return items;
}

function writeSheetObjects_(sheetName, headers, items) {
  var res = getOrCreateSheet_(sheetName, headers);
  var sheet = res.sheet;

  if (sheet.getLastRow() > 1) {
    var clearCols = Math.max(headers.length, sheet.getLastColumn());
    sheet.getRange(2, 1, sheet.getLastRow() - 1, clearCols).clearContent();
  }

  if (!items || items.length === 0) return;

  var rows = items.map(function (item) {
    return headers.map(function (h) {
      return sanitizeCellStr_(item[h]);
    });
  });

  var targetRange = sheet.getRange(2, 1, rows.length, headers.length);
  targetRange.setNumberFormat('@');
  targetRange.setValues(rows);
}

function upsertRowById_(sheetName, headers, obj) {
  var res = getOrCreateSheet_(sheetName, headers);
  var sheet = res.sheet;
  var lastRow = sheet.getLastRow();
  var rowValues = headers.map(function (h) {
    return sanitizeCellStr_(obj[h]);
  });

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(obj.id)) {
        var rRange = sheet.getRange(i + 2, 1, 1, headers.length);
        rRange.setNumberFormat('@');
        rRange.setValues([rowValues]);
        return;
      }
    }
  }

  var appendRow = Math.max(lastRow + 1, 2);
  var newRange = sheet.getRange(appendRow, 1, 1, headers.length);
  newRange.setNumberFormat('@');
  newRange.setValues([rowValues]);
}

function deleteRowById_(sheetName, headers, id) {
  var res = getOrCreateSheet_(sheetName, headers);
  var sheet = res.sheet;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

/**
 * ============================================================================
 * DATA TRANSFORMERS & DEFAULT SEED DATA
 * ============================================================================
 */

function getDefaultSettings_() {
  var defaultLogoSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#059669"/>' +
      '</linearGradient></defs>' +
      '<path d="M64 8 L112 24 V64 C112 94 88 112 64 120 C40 112 16 94 16 64 V24 Z" fill="url(#g)" stroke="#f59e0b" stroke-width="5"/>' +
      '<circle cx="64" cy="56" r="22" fill="#ffffff" opacity="0.15"/>' +
      '<path d="M40 58 L64 46 L88 58 L64 70 Z" fill="#f59e0b"/>' +
      '<path d="M48 63 V75 C48 79 56 83 64 83 C72 83 80 79 80 75 V63 L64 71 Z" fill="#ffffff"/>' +
      '<rect x="83" y="59" width="3" height="16" fill="#f59e0b"/>' +
      '<text x="64" y="102" font-family="sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">SAS</text>' +
      '</svg>'
    );

  return {
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
    schoolLogo: defaultLogoSvg,
    faviconDataUrl: '',
    faviconUrl: '',
  };
}

function getDefaultStudents_() {
  return [];
}

function getDefaultTeachers_() {
  return [];
}

function getDefaultSubjects_() {
  return [];
}

function getDefaultClasses_() {
  return [];
}

function getDefaultSchedules_() {
  return [];
}

function getDefaultTemplates_() {
  return [
    {
      id: 'tmpl-1',
      type: 'masuk_tepat',
      title: 'Kehadiran Tepat Waktu (Masuk)',
      text: '*NOTIFIKASI KEHADIRAN SISWA*\n{sekolah}\n----------------------------------------\nYth. Bapak/Ibu {nama_ortu},\n\nMemberitahukan bahwa putra/putri Anda:\n👤 *Nama:* {nama_siswa}\n🏫 *Kelas:* {kelas}\n🔢 *NIS:* {nis}\n\nTelah hadir di sekolah pada:\n📅 *Hari/Tanggal:* {tanggal}\n⏰ *Waktu:* {waktu}\n✅ *Status:* HADIR TEPAT WAKTU\n\nTerima kasih atas disiplin dan dukungan Bapak/Ibu.\n\n_Pesan otomatis dikirim melalui SAS ({sekolah})._'
    },
    {
      id: 'tmpl-2',
      type: 'masuk_terlambat',
      title: 'Kehadiran Terlambat (Masuk)',
      text: '*PEMBERITAHUAN KETERLAMBATAN SISWA*\n{sekolah}\n----------------------------------------\nYth. Bapak/Ibu {nama_ortu},\n\nMemberitahukan bahwa putra/putri Anda:\n👤 *Nama:* {nama_siswa}\n🏫 *Kelas:* {kelas}\n🔢 *NIS:* {nis}\n\nTelah tiba di sekolah pada:\n📅 *Hari/Tanggal:* {tanggal}\n⏰ *Waktu:* {waktu}\n⚠️ *Status:* TERLAMBAT\n📝 *Catatan:* {catatan}\n\nMohon bantuan Bapak/Ibu untuk memotivasi ananda agar dapat hadir lebih awal.\n\n_Pesan otomatis SAS ({sekolah})._'
    },
    {
      id: 'tmpl-3',
      type: 'izin_sakit',
      title: 'Konfirmasi Izin / Sakit',
      text: '*KONFIRMASI STATUS IZIN/SAKIT*\n{sekolah}\n----------------------------------------\nYth. Bapak/Ibu {nama_ortu},\n\nSekolah telah mencatat permohonan ketidakhadiran putra/putri Anda:\n👤 *Nama:* {nama_siswa}\n🏫 *Kelas:* {kelas}\n📅 *Tanggal:* {tanggal}\n📋 *Keterangan:* {status}\n📄 *Catatan Sekolah:* {catatan}\n\nSemoga ananda lekas sembuh / urusan keluarga berjalan lancar.\n\n_Pusat Layanan Kesiswaan {sekolah}._'
    },
    {
      id: 'tmpl-4',
      type: 'pulang',
      title: 'Kepulangan Siswa (Tap Out)',
      text: '*NOTIFIKASI KEPULANGAN SISWA*\n{sekolah}\n----------------------------------------\nYth. Bapak/Ibu {nama_ortu},\n\nMemberitahukan bahwa ananda telah melakukan absensi kepulangan:\n👤 *Nama:* {nama_siswa}\n🏫 *Kelas:* {kelas}\n📅 *Hari/Tanggal:* {tanggal}\n⏰ *Waktu Pulang:* {waktu}\n🎒 *Status:* SELESAI PEMBELAJARAN\n\nMohon pastikan ananda tiba di rumah dengan selamat.\n\n_Pesan otomatis SAS ({sekolah})._'
    },
    {
      id: 'tmpl-5',
      type: 'peringatan_alpa',
      title: 'Peringatan Siswa Belum Hadir',
      text: '*PERINGATAN KETIDAKHADIRAN SISWA*\n{sekolah}\n----------------------------------------\nYth. Bapak/Ibu {nama_ortu},\n\nHingga pukul {waktu}, data absensi kami mencatat bahwa ananda:\n👤 *Nama:* {nama_siswa}\n🏫 *Kelas:* {kelas}\n🔢 *NIS:* {nis}\n\n*BELUM MELAKUKAN ABSENSI* pada hari ini ({tanggal}).\n\nApabila ananda berhalangan hadir, mohon segera mengonfirmasi kepada wali kelas.\n\n_Kesiswaan & BK {sekolah}._'
    }
  ];
}

function generateInitialRecords_() {
  return [];
}

function studentToRowObj_(s) {
  var descStr = '';
  if (Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128) {
    descStr = JSON.stringify(s.faceDescriptor);
  } else if (typeof s.faceDescriptor === 'string' && s.faceDescriptor.trim().indexOf('[') === 0) {
    descStr = s.faceDescriptor.trim();
  }
  return {
    id: s.id || '',
    nis: s.nis || '',
    nisn: s.nisn || '',
    name: s.name || '',
    gender: s.gender || 'L',
    studentClass: s.studentClass || '',
    parentName: s.parentName || '',
    parentPhone: s.parentPhone || '',
    qrCodeData: s.qrCodeData || '',
    status: s.status || 'aktif',
    address: s.address || '',
    facePhoto: s.facePhoto ? String(s.facePhoto) : '',
    faceDescriptor: descStr,
  };
}

function rowObjToStudent_(row) {
  var parsedDesc;
  if (row.faceDescriptor) {
    try {
      var arr = typeof row.faceDescriptor === 'string' ? JSON.parse(row.faceDescriptor) : row.faceDescriptor;
      if (Array.isArray(arr) && arr.length === 128) {
        parsedDesc = arr.map(function (n) { return Number(n); });
      }
    } catch (e) {}
  }
  return {
    id: row.id || '',
    nis: row.nis || '',
    nisn: row.nisn || '',
    name: row.name || '',
    gender: row.gender || 'L',
    studentClass: row.studentClass || '',
    parentName: row.parentName || '',
    parentPhone: row.parentPhone || '',
    qrCodeData: row.qrCodeData || '',
    status: row.status || 'aktif',
    address: row.address || '',
    facePhoto: row.facePhoto || undefined,
    faceDescriptor: parsedDesc,
  };
}

function recordToRowObj_(r) {
  var wa = r.whatsappNotification || {};
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: r.studentName,
    studentNis: r.studentNis,
    studentClass: r.studentClass,
    parentPhone: r.parentPhone,
    parentName: r.parentName,
    date: r.date,
    checkInTime: r.checkInTime || '',
    checkOutTime: r.checkOutTime || '',
    status: r.status,
    type: r.type || 'masuk',
    attendanceScope: r.attendanceScope || 'harian',
    subjectId: r.subjectId || '',
    subjectName: r.subjectName || '',
    scheduleId: r.scheduleId || '',
    notes: r.notes || '',
    lateMinutes: r.lateMinutes || 0,
    waSent: wa.sent ? 'true' : 'false',
    waSentAt: wa.sentAt || '',
    waStatus: wa.status || 'pending',
    waMessage: wa.message || '',
  };
}

function rowObjToRecord_(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    studentNis: row.studentNis,
    studentClass: row.studentClass,
    parentPhone: row.parentPhone,
    parentName: row.parentName,
    date: row.date,
    checkInTime: row.checkInTime,
    checkOutTime: row.checkOutTime || undefined,
    status: row.status,
    type: row.type || 'masuk',
    attendanceScope: row.attendanceScope || 'harian',
    subjectId: row.subjectId || undefined,
    subjectName: row.subjectName || undefined,
    scheduleId: row.scheduleId || undefined,
    notes: row.notes || undefined,
    lateMinutes: Number(row.lateMinutes || 0),
    whatsappNotification: {
      sent: row.waSent === 'true',
      sentAt: row.waSentAt || undefined,
      status: row.waStatus || 'pending',
      phone: row.parentPhone,
      message: row.waMessage || '',
    },
  };
}

function teacherToRowObj_(t) {
  var specs = Array.isArray(t.subjectSpecialties)
    ? t.subjectSpecialties.join(', ')
    : String(t.subjectSpecialties || '');
  var dDays = Array.isArray(t.dutyDays)
    ? t.dutyDays.join(', ')
    : String(t.dutyDays || '');
  return {
    id: t.id || '',
    nip: t.nip || '',
    name: t.name || '',
    gender: t.gender || 'L',
    phone: t.phone || '',
    email: t.email || '',
    subjectSpecialties: specs,
    isDutyTeacher: t.isDutyTeacher === true || t.isDutyTeacher === 'true' ? 'true' : 'false',
    dutyDays: dDays,
    dutyShift: t.dutyShift || '',
  };
}

function rowObjToTeacher_(row) {
  return {
    id: row.id || '',
    nip: row.nip || '',
    name: row.name || '',
    gender: row.gender || 'L',
    phone: row.phone || '',
    email: row.email || '',
    subjectSpecialties: row.subjectSpecialties
      ? String(row.subjectSpecialties).split(',').map(function (x) { return x.trim(); }).filter(Boolean)
      : [],
    isDutyTeacher: row.isDutyTeacher === 'true' || row.isDutyTeacher === true,
    dutyDays: row.dutyDays
      ? String(row.dutyDays).split(',').map(function (x) { return x.trim(); }).filter(Boolean)
      : [],
    dutyShift: row.dutyShift || '',
  };
}

function getDefaultUsers_() {
  return [];
}

/**
 * Menjamin semua 10 sheet tersedia (struktur bersih tanpa data dummy bawaan)
 */
function ensureAllSheets_(forceReset) {
  if (!forceReset) {
    var ssQuick = getSs_();
    var existingMap = {};
    var sheets = ssQuick.getSheets();
    for (var sIdx = 0; sIdx < sheets.length; sIdx++) {
      var sh = sheets[sIdx];
      if (sh.getLastRow() >= 1) {
        existingMap[sh.getName()] = true;
      }
    }
    var allPresent = true;
    for (var keyName in SHEET_NAMES) {
      if (Object.prototype.hasOwnProperty.call(SHEET_NAMES, keyName)) {
        if (!existingMap[SHEET_NAMES[keyName]]) {
          allPresent = false;
          break;
        }
      }
    }
    if (allPresent) return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // 1. Settings
    var settingsRes = getOrCreateSheet_(SHEET_NAMES.SETTINGS, HEADERS.Pengaturan);
    if (forceReset || settingsRes.sheet.getLastRow() < 2) {
      var defSettings = getDefaultSettings_();
      if (forceReset) {
        var props = PropertiesService.getScriptProperties();
        deleteChunkedProp_(props, LOGO_PROP_KEY);
        deleteChunkedProp_(props, FAVICON_DATA_PROP_KEY);
        props.deleteProperty(FAVICON_URL_PROP_KEY);
        props.deleteProperty(FAVICON_FILE_ID_PROP_KEY);
      }
      saveSettingsInternal_(defSettings);
    }

    // 2. Students
    var studentsRes = getOrCreateSheet_(SHEET_NAMES.STUDENTS, HEADERS.Siswa);
    var defaultStudents = getDefaultStudents_();
    if (forceReset || studentsRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa, defaultStudents.map(studentToRowObj_));
    }

    // 3. Teachers
    var teachersRes = getOrCreateSheet_(SHEET_NAMES.TEACHERS, HEADERS.Guru);
    if (forceReset || teachersRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru, getDefaultTeachers_().map(teacherToRowObj_));
    }

    // 4. Subjects
    var subjectsRes = getOrCreateSheet_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel);
    if (forceReset || subjectsRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel, getDefaultSubjects_());
    }

    // 5. Classes
    var classesRes = getOrCreateSheet_(SHEET_NAMES.CLASSES, HEADERS.Kelas);
    if (forceReset || classesRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas, getDefaultClasses_());
    }

    // 6. Schedules
    var schedulesRes = getOrCreateSheet_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal);
    if (forceReset || schedulesRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal, getDefaultSchedules_());
    }

    // 7. Templates
    var templatesRes = getOrCreateSheet_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA);
    if (forceReset || templatesRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA, getDefaultTemplates_());
    }

    // 8. Records
    var recordsRes = getOrCreateSheet_(SHEET_NAMES.RECORDS, HEADERS.Absensi);
    var seededRecords = null;
    if (forceReset || recordsRes.sheet.getLastRow() < 2) {
      var currentStudents = readSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa).map(rowObjToStudent_);
      seededRecords = generateInitialRecords_(currentStudents.length ? currentStudents : defaultStudents);
      writeSheetObjects_(
        SHEET_NAMES.RECORDS,
        HEADERS.Absensi,
        seededRecords.map(recordToRowObj_)
      );
    }

    // 9. Logs
    var logsRes = getOrCreateSheet_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi);
    if (forceReset || logsRes.sheet.getLastRow() < 2) {
      var srcRecords = seededRecords || readSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi).map(rowObjToRecord_);
      var logs = srcRecords
        .filter(function (r) { return r.whatsappNotification && r.whatsappNotification.sent; })
        .slice(-15)
        .reverse()
        .map(function (r) {
          return {
            id: 'log-' + r.id,
            timestamp: (r.whatsappNotification && r.whatsappNotification.sentAt) || (r.date + ' ' + r.checkInTime),
            studentName: r.studentName,
            studentClass: r.studentClass,
            parentName: r.parentName,
            recipientPhone: r.parentPhone,
            messageType: r.status === 'hadir_tepat' ? 'Kehadiran Tepat Waktu' : r.status === 'terlambat' ? 'Keterlambatan' : 'Surat Izin/Sakit',
            content: (r.whatsappNotification && r.whatsappNotification.message) || ('Laporan kehadiran ' + r.studentName),
            status: (r.whatsappNotification && r.whatsappNotification.status) || 'terkirim',
          };
        });
      writeSheetObjects_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi, logs);
    }

    // 10. Users (Pengguna)
    var usersRes = getOrCreateSheet_(SHEET_NAMES.USERS, HEADERS.Pengguna);
    if (forceReset || usersRes.sheet.getLastRow() < 2) {
      writeSheetObjects_(SHEET_NAMES.USERS, HEADERS.Pengguna, getDefaultUsers_());
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * INTERNAL SETTINGS LOADER / SAVER (Chunked PropertiesService >9KB & >50K safe)
 * ============================================================================
 */
function deleteChunkedProp_(props, baseKey) {
  props.deleteProperty(baseKey);
  var countRaw = props.getProperty(baseKey + '__COUNT');
  var count = countRaw ? parseInt(countRaw, 10) : 0;
  for (var i = 0; i < count; i++) {
    props.deleteProperty(baseKey + '__' + i);
  }
  props.deleteProperty(baseKey + '__COUNT');
}

function setChunkedProp_(props, baseKey, strVal) {
  deleteChunkedProp_(props, baseKey);
  if (!strVal) return true;
  var s = String(strVal);
  if (s.length <= MAX_PROP_CHUNK_LEN) {
    props.setProperty(baseKey, s);
    return true;
  }
  try {
    var idx = 0;
    for (var pos = 0; pos < s.length; pos += MAX_PROP_CHUNK_LEN) {
      props.setProperty(baseKey + '__' + idx, s.slice(pos, pos + MAX_PROP_CHUNK_LEN));
      idx++;
    }
    props.setProperty(baseKey + '__COUNT', String(idx));
    return true;
  } catch (err) {
    Logger.log('Chunked property gagal untuk ' + baseKey + ': ' + err);
    deleteChunkedProp_(props, baseKey);
    return false;
  }
}

function getChunkedProp_(props, baseKey) {
  var countRaw = props.getProperty(baseKey + '__COUNT');
  if (countRaw) {
    var count = parseInt(countRaw, 10);
    if (!isNaN(count) && count > 0) {
      var parts = [];
      for (var i = 0; i < count; i++) {
        var p = props.getProperty(baseKey + '__' + i);
        if (p === null) return null;
        parts.push(p);
      }
      return parts.join('');
    }
  }
  return props.getProperty(baseKey);
}

function saveFaviconPngToDrive_(pngDataUrl) {
  if (!pngDataUrl || String(pngDataUrl).indexOf('data:image/png;base64,') !== 0) {
    return '';
  }
  var file = null;
  try {
    var b64 = String(pngDataUrl).split(',')[1];
    if (!b64) return '';
    var bytes = Utilities.base64Decode(b64);
    var blob = Utilities.newBlob(bytes, 'image/png', 'SAS_Favicon_Sekolah.png');

    var props = PropertiesService.getScriptProperties();
    var oldFileId = props.getProperty(FAVICON_FILE_ID_PROP_KEY);
    if (oldFileId) {
      try {
        DriveApp.getFileById(oldFileId).setTrashed(true);
      } catch (ignore) {}
    }

    file = DriveApp.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      try {
        file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (domainErr) {
        try { file.setTrashed(true); } catch (trashErr) {}
        Logger.log('Sharing Drive dibatasi admin Workspace: ' + domainErr);
        return '';
      }
    }
    var fileId = file.getId();
    props.setProperty(FAVICON_FILE_ID_PROP_KEY, fileId);
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w128&format=png';
  } catch (err) {
    if (file) {
      try { file.setTrashed(true); } catch (ignore2) {}
    }
    Logger.log('Opsional Drive favicon dilewati: ' + err);
    return '';
  }
}

function readSettingsInternal_() {
  var rows = readSheetObjects_(SHEET_NAMES.SETTINGS, HEADERS.Pengaturan);
  var settings = getDefaultSettings_();
  var timeKeys = {
    checkInStartTime: true,
    checkInDeadline: true,
    checkInLateTolerance: true,
    checkOutStartTime: true,
  };

  for (var i = 0; i < rows.length; i++) {
    var k = rows[i].key;
    var v = rows[i].value;
    if (!k) continue;
    if (k === 'autoSendWhatsApp') {
      settings[k] = v === 'true';
    } else if (timeKeys[k] && /^\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/.test(String(v))) {
      settings[k] = String(v).match(/^\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/)[1];
    } else {
      settings[k] = v;
    }
  }

  var props = PropertiesService.getScriptProperties();
  var propLogo = getChunkedProp_(props, LOGO_PROP_KEY);
  if (propLogo !== null) {
    settings.schoolLogo = propLogo;
  } else if (settings.schoolLogo === '[STORED_IN_PROPERTIES]') {
    settings.schoolLogo = '';
  }

  var propFavData = getChunkedProp_(props, FAVICON_DATA_PROP_KEY);
  if (propFavData !== null) {
    settings.faviconDataUrl = propFavData;
  } else if (settings.faviconDataUrl === '[STORED_IN_PROPERTIES]') {
    settings.faviconDataUrl = '';
  }

  var propFavUrl = props.getProperty(FAVICON_URL_PROP_KEY);
  if (propFavUrl !== null) {
    settings.faviconUrl = propFavUrl;
  }

  return settings;
}

function saveSettingsInternal_(settingsObj) {
  var merged = getDefaultSettings_();
  for (var k in settingsObj) {
    if (Object.prototype.hasOwnProperty.call(settingsObj, k)) {
      merged[k] = settingsObj[k];
    }
  }

  var props = PropertiesService.getScriptProperties();
  var logoStr = merged.schoolLogo ? String(merged.schoolLogo) : '';
  var favDataStr = merged.faviconDataUrl ? String(merged.faviconDataUrl) : '';
  var manualFavUrl = merged.faviconUrl ? String(merged.faviconUrl).trim() : '';

  // Simpan logo & favicon PNG di ScriptProperties secara terpecah (chunk < 9KB per kunci)
  setChunkedProp_(props, LOGO_PROP_KEY, logoStr);
  setChunkedProp_(props, FAVICON_DATA_PROP_KEY, favDataStr);

  var resolvedFavUrl = '';
  if (isValidGasFaviconUrl_(manualFavUrl)) {
    resolvedFavUrl = manualFavUrl;
  } else if (isValidGasFaviconUrl_(logoStr)) {
    resolvedFavUrl = logoStr;
  } else if (logoStr && favDataStr.indexOf('data:image/png;base64,') === 0) {
    resolvedFavUrl = saveFaviconPngToDrive_(favDataStr);
  }

  if (!logoStr && !isValidGasFaviconUrl_(manualFavUrl)) {
    resolvedFavUrl = '';
    deleteChunkedProp_(props, FAVICON_DATA_PROP_KEY);
  }

  merged.faviconUrl = resolvedFavUrl;
  props.setProperty(FAVICON_URL_PROP_KEY, resolvedFavUrl);

  // Simpan juga ke sheet Pengaturan dengan batas aman 49.000 karakter sel Google Sheets
  var rows = [];
  for (var key in merged) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) continue;
    var val = merged[key];
    if ((key === 'schoolLogo' || key === 'faviconDataUrl') && String(val || '').length > 45000) {
      val = '[STORED_IN_PROPERTIES]';
    }
    rows.push({ key: key, value: val === undefined || val === null ? '' : String(val) });
  }
  writeSheetObjects_(SHEET_NAMES.SETTINGS, HEADERS.Pengaturan, rows);
  return merged;
}

/**
 * ============================================================================
 * PUBLIC RPC FUNCTIONS (Dipanggil via google.script.run dari Index.html)
 * ============================================================================
 */

function getBootstrapData() {
  ensureAllSheets_(false);

  var students = readSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa).map(rowObjToStudent_);
  var rawRecords = readSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi);
  var records = rawRecords.map(rowObjToRecord_);

  var classes = readSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas).map(function (c) {
    c.capacity = Number(c.capacity || 32);
    return c;
  });

  var subjects = readSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel).map(function (s) {
    s.hoursPerWeek = Number(s.hoursPerWeek || 2);
    return s;
  });

  var teachers = readSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru).map(rowObjToTeacher_);

  var schedules = readSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal);
  var templates = readSheetObjects_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA);
  var logs = readSheetObjects_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi);
  var registeredUsers = readSheetObjects_(SHEET_NAMES.USERS, HEADERS.Pengguna);
  var settings = readSettingsInternal_();

  return {
    students: students,
    records: records,
    classes: classes,
    subjects: subjects,
    teachers: teachers,
    schedules: schedules,
    templates: templates,
    logs: logs,
    registeredUsers: registeredUsers,
    settings: settings,
    spreadsheetUrl: getSs_().getUrl(),
    webAppUrl: getWebAppUrlSafe_(),
  };
}

function saveSettings(settingsObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return saveSettingsInternal_(settingsObj);
  } finally {
    lock.releaseLock();
  }
}

function saveStudent(studentObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.STUDENTS, HEADERS.Siswa, studentToRowObj_(studentObj));
    return readSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa).map(rowObjToStudent_);
  } finally {
    lock.releaseLock();
  }
}

function deleteStudent(studentId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowById_(SHEET_NAMES.STUDENTS, HEADERS.Siswa, studentId);
    return readSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa).map(rowObjToStudent_);
  } finally {
    lock.releaseLock();
  }
}

function recordAttendance(recordObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var rowObj = recordToRowObj_(recordObj);
    upsertRowById_(SHEET_NAMES.RECORDS, HEADERS.Absensi, rowObj);

    if (recordObj.whatsappNotification && recordObj.whatsappNotification.sent) {
      var logObj = {
        id: 'log-' + Date.now() + '-' + recordObj.studentId,
        timestamp: recordObj.whatsappNotification.sentAt || (recordObj.date + ' ' + recordObj.checkInTime),
        studentName: recordObj.studentName,
        studentClass: recordObj.studentClass,
        parentName: recordObj.parentName,
        recipientPhone: recordObj.parentPhone,
        messageType: recordObj.status === 'hadir_tepat' ? 'Presensi Tepat Waktu' : recordObj.status === 'terlambat' ? 'Presensi Terlambat' : 'Pemberitahuan Izin/Sakit',
        content: recordObj.whatsappNotification.message || ('Laporan kehadiran status: ' + recordObj.status),
        status: recordObj.whatsappNotification.status || 'terkirim',
      };
      upsertRowById_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi, logObj);
    }

    return {
      records: readSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi).map(rowObjToRecord_),
      logs: readSheetObjects_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveClass(clsObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.CLASSES, HEADERS.Kelas, clsObj);
    return readSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas).map(function (c) {
      c.capacity = Number(c.capacity || 32);
      return c;
    });
  } finally {
    lock.releaseLock();
  }
}

function deleteClass(classId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowById_(SHEET_NAMES.CLASSES, HEADERS.Kelas, classId);
    return readSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas).map(function (c) {
      c.capacity = Number(c.capacity || 32);
      return c;
    });
  } finally {
    lock.releaseLock();
  }
}

function saveSubject(sbjObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel, sbjObj);
    return readSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel).map(function (s) {
      s.hoursPerWeek = Number(s.hoursPerWeek || 2);
      return s;
    });
  } finally {
    lock.releaseLock();
  }
}

function deleteSubject(subjectId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowById_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel, subjectId);
    return readSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel).map(function (s) {
      s.hoursPerWeek = Number(s.hoursPerWeek || 2);
      return s;
    });
  } finally {
    lock.releaseLock();
  }
}

function saveTeacher(tchObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.TEACHERS, HEADERS.Guru, teacherToRowObj_(tchObj));
    return readSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru).map(rowObjToTeacher_);
  } finally {
    lock.releaseLock();
  }
}

function deleteTeacher(teacherId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowById_(SHEET_NAMES.TEACHERS, HEADERS.Guru, teacherId);
    return readSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru).map(rowObjToTeacher_);
  } finally {
    lock.releaseLock();
  }
}

function saveSchedule(schObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!schObj.classId && schObj.className) {
      var clsList = readSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas);
      for (var i = 0; i < clsList.length; i++) {
        if (clsList[i].name === schObj.className) {
          schObj.classId = clsList[i].id;
          break;
        }
      }
    }
    if (!schObj.subjectId && schObj.subjectName) {
      var sbjList = readSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel);
      for (var j = 0; j < sbjList.length; j++) {
        if (sbjList[j].name === schObj.subjectName) {
          schObj.subjectId = sbjList[j].id;
          break;
        }
      }
    }
    var tchList = readSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru);
    if (!schObj.teacherId && schObj.teacherName) {
      for (var k = 0; k < tchList.length; k++) {
        if (tchList[k].name === schObj.teacherName) {
          schObj.teacherId = tchList[k].id;
          break;
        }
      }
    }
    if (schObj.dutyTeacherName && !schObj.dutyTeacherId) {
      for (var m = 0; m < tchList.length; m++) {
        if (tchList[m].name === schObj.dutyTeacherName) {
          schObj.dutyTeacherId = tchList[m].id;
          break;
        }
      }
    } else if (!schObj.dutyTeacherName) {
      schObj.dutyTeacherId = '';
    }
    upsertRowById_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal, schObj);
    return readSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal);
  } finally {
    lock.releaseLock();
  }
}

function deleteSchedule(scheduleId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowById_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal, scheduleId);
    return readSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal);
  } finally {
    lock.releaseLock();
  }
}

function saveTemplate(tmplObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA, tmplObj);
    return readSheetObjects_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA);
  } finally {
    lock.releaseLock();
  }
}

function addNotificationLog(logObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertRowById_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi, logObj);
    return readSheetObjects_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi);
  } finally {
    lock.releaseLock();
  }
}

function registerUser(userObj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = readSheetObjects_(SHEET_NAMES.USERS, HEADERS.Pengguna);
    var cleanUser = String(userObj.username || '').trim().toLowerCase();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i].username || '').toLowerCase() === cleanUser) {
        throw new Error('Username "' + cleanUser + '" sudah terdaftar di sheet Pengguna.');
      }
    }
    var newUser = {
      id: userObj.id || ('usr-' + Date.now()),
      username: cleanUser,
      password: String(userObj.password || ''),
      displayName: String(userObj.displayName || cleanUser),
      role: String(userObj.role || 'Guru Piket'),
      createdAt: userObj.createdAt || new Date().toISOString(),
    };
    upsertRowById_(SHEET_NAMES.USERS, HEADERS.Pengguna, newUser);
    return readSheetObjects_(SHEET_NAMES.USERS, HEADERS.Pengguna);
  } finally {
    lock.releaseLock();
  }
}

function deleteAllStudents() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function deleteAllClasses() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function deleteAllSubjects() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function deleteAllTeachers() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function clearAllDutyTeachers() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var teachers = readSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru).map(rowObjToTeacher_).map(function (t) {
      t.isDutyTeacher = false;
      t.dutyDays = [];
      t.dutyShift = '';
      return t;
    });
    writeSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru, teachers.map(teacherToRowObj_));
    return teachers;
  } finally {
    lock.releaseLock();
  }
}

function deleteAllSchedules() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function deleteStudentRecords(studentId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var raw = readSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi);
    var remaining = raw.filter(function (row) {
      return String(row.studentId || '') !== String(studentId || '');
    });
    writeSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi, remaining);
    return remaining.map(rowObjToRecord_);
  } finally {
    lock.releaseLock();
  }
}

function deleteRecordsByDate(dateStr) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var raw = readSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi);
    var remaining = raw.filter(function (row) {
      return String(row.date || '') !== String(dateStr || '');
    });
    writeSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi, remaining);
    return remaining.map(rowObjToRecord_);
  } finally {
    lock.releaseLock();
  }
}

function deleteAllRecords() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi, []);
    return [];
  } finally {
    lock.releaseLock();
  }
}

function resetDemoData() {
  ensureAllSheets_(true);
  return getBootstrapData();
}

function importBackupJson(jsonString) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed.students)) {
      writeSheetObjects_(SHEET_NAMES.STUDENTS, HEADERS.Siswa, parsed.students.map(studentToRowObj_));
    }
    if (Array.isArray(parsed.records)) {
      writeSheetObjects_(SHEET_NAMES.RECORDS, HEADERS.Absensi, parsed.records.map(recordToRowObj_));
    }
    if (parsed.settings) {
      saveSettingsInternal_(parsed.settings);
    }
    if (Array.isArray(parsed.templates)) {
      writeSheetObjects_(SHEET_NAMES.TEMPLATES, HEADERS.TemplateWA, parsed.templates);
    }
    if (Array.isArray(parsed.logs)) {
      writeSheetObjects_(SHEET_NAMES.LOGS, HEADERS.LogNotifikasi, parsed.logs);
    }
    if (Array.isArray(parsed.classes)) {
      writeSheetObjects_(SHEET_NAMES.CLASSES, HEADERS.Kelas, parsed.classes);
    }
    if (Array.isArray(parsed.subjects)) {
      writeSheetObjects_(SHEET_NAMES.SUBJECTS, HEADERS.Mapel, parsed.subjects);
    }
    if (Array.isArray(parsed.teachers)) {
      writeSheetObjects_(SHEET_NAMES.TEACHERS, HEADERS.Guru, parsed.teachers.map(teacherToRowObj_));
    }
    if (Array.isArray(parsed.schedules)) {
      writeSheetObjects_(SHEET_NAMES.SCHEDULES, HEADERS.Jadwal, parsed.schedules);
    }
    if (Array.isArray(parsed.registeredUsers)) {
      writeSheetObjects_(SHEET_NAMES.USERS, HEADERS.Pengguna, parsed.registeredUsers);
    }
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}
