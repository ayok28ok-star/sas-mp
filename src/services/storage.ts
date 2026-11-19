import { AttendanceRecord, AuthUser, ClassSchedule, NotificationLog, RegisteredUser, SchoolClass, SchoolSettings, Student, Subject, Teacher, WhatsAppTemplate } from '../types/attendance';
import {
  defaultSchoolSettings,
  defaultStudents,
  defaultWhatsAppTemplates,
  generateInitialLogs,
  generateInitialRecords,
} from '../data/initialData';
import {
  defaultClasses,
  defaultSchedules,
  defaultSubjects,
  defaultTeachers,
} from '../data/scheduleData';

const STORAGE_KEYS = {
  STUDENTS: 'absensi_students_v1',
  RECORDS: 'absensi_records_v1',
  SETTINGS: 'absensi_settings_v1',
  TEMPLATES: 'absensi_templates_v1',
  LOGS: 'absensi_logs_v1',
  CLASSES: 'absensi_classes_v1',
  SUBJECTS: 'absensi_subjects_v1',
  TEACHERS: 'absensi_teachers_v1',
  SCHEDULES: 'absensi_schedules_v1',
  USER_THEME: 'absensi_user_theme_v1',
  AUTH_USER: 'absensi_auth_user_v1',
  REGISTERED_USERS: 'absensi_registered_users_v1',
  CLEAN_SLATE_DONE: 'absensi_clean_slate_v2',
};

const LEGACY_DEMO_STUDENT_IDS = new Set(
  Array.from({ length: 16 }, (_, i) => `std-${String(i + 1).padStart(3, '0')}`)
);
const LEGACY_DEMO_CLASS_IDS = new Set(['cls-01', 'cls-02', 'cls-03', 'cls-04']);
const LEGACY_DEMO_SUBJECT_IDS = new Set([
  'sbj-01',
  'sbj-02',
  'sbj-03',
  'sbj-04',
  'sbj-05',
  'sbj-06',
  'sbj-07',
]);
const LEGACY_DEMO_TEACHER_IDS = new Set([
  'tch-01',
  'tch-02',
  'tch-03',
  'tch-04',
  'tch-05',
  'tch-06',
]);
const LEGACY_DEMO_SCHEDULE_IDS = new Set([
  'sch-01',
  'sch-02',
  'sch-03',
  'sch-04',
  'sch-05',
  'sch-06',
  'sch-07',
  'sch-08',
  'sch-09',
]);

function purgeLegacyDefaultDemoDataOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.CLEAN_SLATE_DONE) === '1') return;

    const filterKey = <T extends { id?: string }>(
      key: string,
      isLegacyFn: (item: T) => boolean
    ) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed.filter((item: T) => !isLegacyFn(item));
      localStorage.setItem(key, JSON.stringify(cleaned));
    };

    filterKey<Student>(STORAGE_KEYS.STUDENTS, (s) => LEGACY_DEMO_STUDENT_IDS.has(s.id));
    filterKey<SchoolClass>(STORAGE_KEYS.CLASSES, (c) => LEGACY_DEMO_CLASS_IDS.has(c.id));
    filterKey<Subject>(STORAGE_KEYS.SUBJECTS, (s) => LEGACY_DEMO_SUBJECT_IDS.has(s.id));
    filterKey<Teacher>(STORAGE_KEYS.TEACHERS, (t) => LEGACY_DEMO_TEACHER_IDS.has(t.id));
    filterKey<ClassSchedule>(STORAGE_KEYS.SCHEDULES, (s) => LEGACY_DEMO_SCHEDULE_IDS.has(s.id));
    filterKey<AttendanceRecord>(
      STORAGE_KEYS.RECORDS,
      (r) =>
        LEGACY_DEMO_STUDENT_IDS.has(r.studentId) ||
        /^rec-\d{4}-\d{2}-\d{2}-std-\d{3}$/.test(String(r.id || ''))
    );
    filterKey<NotificationLog>(
      STORAGE_KEYS.LOGS,
      (l) => /^log-rec-\d{4}-\d{2}-\d{2}-std-\d{3}$/.test(String(l.id || ''))
    );

    localStorage.setItem(STORAGE_KEYS.CLEAN_SLATE_DONE, '1');
  } catch {
    // ignore storage errors
  }
}

export const StorageService = {
  getStudents(): Student[] {
    purgeLegacyDefaultDemoDataOnce();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading students', e);
    }
    const initial = defaultStudents;
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(initial));
    return initial;
  },

  saveStudents(students: Student[]) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  getClasses(): SchoolClass[] {
    purgeLegacyDefaultDemoDataOnce();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading classes', e);
    }
    const initial = defaultClasses;
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(initial));
    return initial;
  },

  saveClasses(classes: SchoolClass[]) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  },

  getSubjects(): Subject[] {
    purgeLegacyDefaultDemoDataOnce();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading subjects', e);
    }
    const initial = defaultSubjects;
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(initial));
    return initial;
  },

  saveSubjects(subjects: Subject[]) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  },

  getTeachers(): Teacher[] {
    purgeLegacyDefaultDemoDataOnce();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading teachers', e);
    }
    const initial = defaultTeachers;
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(initial));
    return initial;
  },

  saveTeachers(teachers: Teacher[]) {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
  },

  getSchedules(): ClassSchedule[] {
    purgeLegacyDefaultDemoDataOnce();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error reading schedules', e);
    }
    const initial = defaultSchedules;
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(initial));
    return initial;
  },

  saveSchedules(schedules: ClassSchedule[]) {
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  },

  getUserTheme(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.USER_THEME);
    } catch {
      return null;
    }
  },

  saveUserTheme(themeId: string) {
    localStorage.setItem(STORAGE_KEYS.USER_THEME, themeId);
  },

  getSettings(): SchoolSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        const migratedSchoolName =
          parsed.schoolName === 'SMA Negeri 1 Nusantara Mandiri'
            ? 'SMP Negeri 1 Nusantara Mandiri'
            : parsed.schoolName;
        const migratedBotName =
          parsed.botSenderName === 'Sistem Absensi Otomatis SMAN 1 Nusantara'
            ? 'Sistem Absensi Otomatis SMPN 1 Nusantara'
            : parsed.botSenderName;
        const merged: SchoolSettings = {
          ...defaultSchoolSettings,
          ...parsed,
          schoolName: migratedSchoolName ?? defaultSchoolSettings.schoolName,
          botSenderName: migratedBotName ?? defaultSchoolSettings.botSenderName,
          schoolLogo:
            parsed.schoolLogo !== undefined
              ? parsed.schoolLogo
              : defaultSchoolSettings.schoolLogo,
        };
        if (
          parsed.schoolLogo === undefined ||
          migratedSchoolName !== parsed.schoolName ||
          migratedBotName !== parsed.botSenderName
        ) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
        }
        return merged;
      }
    } catch (e) {
      console.error('Error reading settings', e);
    }
    const initial = defaultSchoolSettings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initial));
    return initial;
  },

  saveSettings(settings: SchoolSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getTemplates(): WhatsAppTemplate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error reading templates', e);
    }
    const initial = defaultWhatsAppTemplates;
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(initial));
    return initial;
  },

  saveTemplates(templates: WhatsAppTemplate[]) {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  },

  getRecords(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error reading records', e);
    }
    const students = this.getStudents();
    const settings = this.getSettings();
    const initial = generateInitialRecords(students, settings);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(initial));
    return initial;
  },

  saveRecords(records: AttendanceRecord[]) {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  },

  getLogs(): NotificationLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error reading logs', e);
    }
    const records = this.getRecords();
    const initial = generateInitialLogs(records);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(initial));
    return initial;
  },

  saveLogs(logs: NotificationLog[]) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  },

  addLog(log: NotificationLog) {
    const existing = this.getLogs();
    const updated = [log, ...existing].slice(0, 100); // keep last 100
    this.saveLogs(updated);
    return updated;
  },

  getAuthUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (data) return JSON.parse(data);
    } catch {
      return null;
    }
    return null;
  },

  saveAuthUser(user: AuthUser) {
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
  },

  clearAuthUser() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  },

  getRegisteredUsers(): RegisteredUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
      if (data) return JSON.parse(data);
    } catch {
      return [];
    }
    return [];
  },

  saveRegisteredUsers(users: RegisteredUser[]) {
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
  },

  addRegisteredUser(user: RegisteredUser): RegisteredUser[] {
    const existing = this.getRegisteredUsers();
    const updated = [user, ...existing];
    this.saveRegisteredUsers(updated);
    return updated;
  },

  resetToDefault() {
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.CLASSES);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.TEACHERS);
    localStorage.removeItem(STORAGE_KEYS.SCHEDULES);
    localStorage.removeItem(STORAGE_KEYS.USER_THEME);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(STORAGE_KEYS.REGISTERED_USERS);
    window.location.reload();
  },

  exportAllData(): string {
    const backup = {
      students: this.getStudents(),
      records: this.getRecords(),
      settings: this.getSettings(),
      templates: this.getTemplates(),
      logs: this.getLogs(),
      classes: this.getClasses(),
      subjects: this.getSubjects(),
      teachers: this.getTeachers(),
      schedules: this.getSchedules(),
      registeredUsers: this.getRegisteredUsers(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importData(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.students && Array.isArray(parsed.students)) {
        this.saveStudents(parsed.students);
      }
      if (parsed.records && Array.isArray(parsed.records)) {
        this.saveRecords(parsed.records);
      }
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      if (parsed.templates && Array.isArray(parsed.templates)) {
        this.saveTemplates(parsed.templates);
      }
      if (parsed.logs && Array.isArray(parsed.logs)) {
        this.saveLogs(parsed.logs);
      }
      if (parsed.classes && Array.isArray(parsed.classes)) {
        this.saveClasses(parsed.classes);
      }
      if (parsed.subjects && Array.isArray(parsed.subjects)) {
        this.saveSubjects(parsed.subjects);
      }
      if (parsed.teachers && Array.isArray(parsed.teachers)) {
        this.saveTeachers(parsed.teachers);
      }
      if (parsed.schedules && Array.isArray(parsed.schedules)) {
        this.saveSchedules(parsed.schedules);
      }
      if (parsed.registeredUsers && Array.isArray(parsed.registeredUsers)) {
        this.saveRegisteredUsers(parsed.registeredUsers);
      }
      return true;
    } catch (e) {
      console.error('Failed to parse import data', e);
      return false;
    }
  },
};

