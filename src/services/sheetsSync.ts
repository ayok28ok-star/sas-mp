import {
  AttendanceRecord,
  ClassSchedule,
  NotificationLog,
  RegisteredUser,
  SchoolClass,
  SchoolSettings,
  Student,
  Subject,
  Teacher,
  WhatsAppTemplate,
} from '../types/attendance';
import { StorageService } from './storage';

const STORAGE_KEYS = {
  API_URL: 'sas_sheets_api_url_v1',
  SYNC_TOKEN: 'sas_sheets_sync_token_v1',
  PENDING_QUEUE: 'sas_sheets_pending_queue_v1',
  LAST_SYNC_AT: 'sas_sheets_last_sync_at_v1',
  SPREADSHEET_URL: 'sas_sheets_spreadsheet_url_v1',
};

export type SheetsApiAction =
  | 'ping'
  | 'bootstrap'
  | 'recordAttendance'
  | 'saveStudent'
  | 'deleteStudent'
  | 'deleteAllStudents'
  | 'saveSettings'
  | 'saveClass'
  | 'deleteClass'
  | 'deleteAllClasses'
  | 'saveSubject'
  | 'deleteSubject'
  | 'deleteAllSubjects'
  | 'saveTeacher'
  | 'deleteTeacher'
  | 'deleteAllTeachers'
  | 'saveSchedule'
  | 'deleteSchedule'
  | 'deleteAllSchedules'
  | 'deleteStudentRecords'
  | 'deleteRecordsByDate'
  | 'deleteAllRecords'
  | 'saveTemplate'
  | 'addNotificationLog'
  | 'registerUser'
  | 'syncAll'
  | 'resetDemoData';

export interface PendingSyncItem {
  queueId: string;
  action: SheetsApiAction;
  entityKey?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SheetsBootstrapData {
  students: Student[];
  records: AttendanceRecord[];
  classes: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  schedules: ClassSchedule[];
  templates: WhatsAppTemplate[];
  logs: NotificationLog[];
  registeredUsers: RegisteredUser[];
  settings: SchoolSettings;
  spreadsheetUrl?: string;
  webAppUrl?: string;
}

export interface SheetsSyncStatus {
  isConfigured: boolean;
  source: 'env' | 'local' | 'none';
  apiUrl: string;
  spreadsheetUrl: string;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

const ENV_GAS_URL = (import.meta.env.VITE_GAS_API_URL || '').trim();
const ENV_GAS_TOKEN = (import.meta.env.VITE_GAS_SYNC_TOKEN || '').trim();

let isSyncingFlag = false;
let lastErrorMsg: string | null = null;
let flushInFlight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore subscriber error
    }
  });
}

function safeLocalGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeLocalSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage quota errors
  }
}

function readPendingQueue(): PendingSyncItem[] {
  try {
    const raw = safeLocalGet(STORAGE_KEYS.PENDING_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingQueue(items: PendingSyncItem[]) {
  safeLocalSet(STORAGE_KEYS.PENDING_QUEUE, items.length ? JSON.stringify(items) : '');
  notifyListeners();
}

export function isValidGasWebAppUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/script\.google(usercontent)?\.com\//i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

// Capture ?gas_url=https://script.google.com/... from share links automatically
function captureUrlParamIfPresent() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const gasParam = url.searchParams.get('gas_url');
    if (gasParam && /^https:\/\/script\.google\.com\//i.test(gasParam.trim())) {
      safeLocalSet(STORAGE_KEYS.API_URL, gasParam.trim());
      url.searchParams.delete('gas_url');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore URL parsing issues
  }
}
captureUrlParamIfPresent();

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20000
): Promise<{ ok: boolean; data?: unknown; error?: string; serverTime?: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error(`Respons kosong dari Google Apps Script (HTTP ${response.status}).`);
    }
    if (trimmed.startsWith('<')) {
      throw new Error(
        'Apps Script mengembalikan halaman HTML, bukan JSON. Pastikan saat Deploy Web App memilih "Execute as: Me" dan "Who has access: Anyone" (atau kode Code.gs sudah diperbarui).'
      );
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || parsed.ok === false) {
      throw new Error(parsed?.error || 'Google Apps Script mengembalikan status gagal.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Koneksi ke Google Spreadsheet timeout. Periksa jaringan internet.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export const SheetsSyncService = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getGasApiUrl(): string {
    const localUrl = safeLocalGet(STORAGE_KEYS.API_URL).trim();
    return localUrl || ENV_GAS_URL;
  },

  getConfiguredSource(): 'env' | 'local' | 'none' {
    if (safeLocalGet(STORAGE_KEYS.API_URL).trim()) return 'local';
    if (ENV_GAS_URL) return 'env';
    return 'none';
  },

  setGasApiUrl(url: string) {
    const clean = url.trim();
    safeLocalSet(STORAGE_KEYS.API_URL, clean);
    if (!clean) {
      safeLocalSet(STORAGE_KEYS.SPREADSHEET_URL, '');
      safeLocalSet(STORAGE_KEYS.LAST_SYNC_AT, '');
      lastErrorMsg = null;
    }
    notifyListeners();
  },

  getSyncToken(): string {
    return safeLocalGet(STORAGE_KEYS.SYNC_TOKEN).trim() || ENV_GAS_TOKEN;
  },

  setSyncToken(token: string) {
    safeLocalSet(STORAGE_KEYS.SYNC_TOKEN, token.trim());
    notifyListeners();
  },

  isConfigured(): boolean {
    return Boolean(this.getGasApiUrl());
  },

  getStatus(): SheetsSyncStatus {
    const apiUrl = this.getGasApiUrl();
    return {
      isConfigured: Boolean(apiUrl),
      source: this.getConfiguredSource(),
      apiUrl,
      spreadsheetUrl: safeLocalGet(STORAGE_KEYS.SPREADSHEET_URL),
      isSyncing: isSyncingFlag,
      pendingCount: readPendingQueue().length,
      lastSyncAt: safeLocalGet(STORAGE_KEYS.LAST_SYNC_AT) || null,
      lastError: lastErrorMsg,
    };
  },

  async testConnection(
    customUrl?: string,
    customToken?: string
  ): Promise<{ ok: boolean; spreadsheetUrl?: string; webAppUrl?: string; error?: string }> {
    const targetUrl = (customUrl ?? this.getGasApiUrl()).trim();
    const targetToken = (customToken ?? this.getSyncToken()).trim();

    if (!targetUrl) {
      return { ok: false, error: 'Masukkan URL Web App Google Apps Script terlebih dahulu.' };
    }
    if (!isValidGasWebAppUrl(targetUrl)) {
      return { ok: false, error: 'URL harus diawali https://script.google.com/macros/s/...' };
    }

    isSyncingFlag = true;
    lastErrorMsg = null;
    notifyListeners();

    try {
      const sep = targetUrl.includes('?') ? '&' : '?';
      const pingUrl =
        targetUrl +
        sep +
        'action=ping' +
        (targetToken ? `&token=${encodeURIComponent(targetToken)}` : '');
      const res = await fetchJsonWithTimeout(pingUrl, { method: 'GET', cache: 'no-store' }, 20000);
      const data = res as unknown as {
        spreadsheetUrl?: string;
        webAppUrl?: string;
        data?: { spreadsheetUrl?: string; webAppUrl?: string };
      };
      const sheetUrl = data.spreadsheetUrl || data.data?.spreadsheetUrl || '';
      const webUrl = data.webAppUrl || data.data?.webAppUrl || targetUrl;

      if (sheetUrl) {
        safeLocalSet(STORAGE_KEYS.SPREADSHEET_URL, sheetUrl);
      }
      safeLocalSet(STORAGE_KEYS.LAST_SYNC_AT, new Date().toISOString());
      lastErrorMsg = null;
      return { ok: true, spreadsheetUrl: sheetUrl, webAppUrl: webUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal terhubung ke Google Apps Script.';
      lastErrorMsg = msg;
      return { ok: false, error: msg };
    } finally {
      isSyncingFlag = false;
      notifyListeners();
    }
  },

  async fetchBootstrapFromSheets(): Promise<SheetsBootstrapData | null> {
    const targetUrl = this.getGasApiUrl();
    if (!targetUrl) return null;

    isSyncingFlag = true;
    notifyListeners();

    try {
      const token = this.getSyncToken();
      const sep = targetUrl.includes('?') ? '&' : '?';
      const bootUrl =
        targetUrl +
        sep +
        'action=bootstrap' +
        (token ? `&token=${encodeURIComponent(token)}` : '');
      const res = await fetchJsonWithTimeout(bootUrl, { method: 'GET', cache: 'no-store' }, 25000);
      const data = res.data as SheetsBootstrapData | undefined;
      if (!data) {
        throw new Error('Data bootstrap dari Google Spreadsheet kosong.');
      }
      if (data.spreadsheetUrl) {
        safeLocalSet(STORAGE_KEYS.SPREADSHEET_URL, data.spreadsheetUrl);
      }
      safeLocalSet(STORAGE_KEYS.LAST_SYNC_AT, new Date().toISOString());
      lastErrorMsg = null;
      return data;
    } catch (err) {
      lastErrorMsg =
        err instanceof Error ? err.message : 'Gagal menarik data dari Google Spreadsheet.';
      throw err;
    } finally {
      isSyncingFlag = false;
      notifyListeners();
    }
  },

  applyBootstrapToLocalStorage(data: SheetsBootstrapData) {
    if (Array.isArray(data.students) && data.students.length > 0) {
      StorageService.saveStudents(data.students);
    } else if (Array.isArray(data.students)) {
      StorageService.saveStudents(data.students);
    }
    if (Array.isArray(data.records)) {
      StorageService.saveRecords(data.records);
    }
    if (data.settings) {
      StorageService.saveSettings(data.settings);
    }
    if (Array.isArray(data.classes)) {
      StorageService.saveClasses(data.classes);
    }
    if (Array.isArray(data.subjects)) {
      StorageService.saveSubjects(data.subjects);
    }
    if (Array.isArray(data.teachers)) {
      StorageService.saveTeachers(data.teachers);
    }
    if (Array.isArray(data.schedules)) {
      StorageService.saveSchedules(data.schedules);
    }
    if (Array.isArray(data.templates)) {
      StorageService.saveTemplates(data.templates);
    }
    if (Array.isArray(data.logs)) {
      StorageService.saveLogs(data.logs);
    }
    if (Array.isArray(data.registeredUsers)) {
      StorageService.saveRegisteredUsers(data.registeredUsers);
    }
  },

  async postAction(
    action: SheetsApiAction,
    payload: Record<string, unknown> = {}
  ): Promise<unknown> {
    const targetUrl = this.getGasApiUrl();
    if (!targetUrl) return null;

    const token = this.getSyncToken();
    const res = await fetchJsonWithTimeout(
      targetUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action,
          token,
          payload,
        }),
      },
      25000
    );

    safeLocalSet(STORAGE_KEYS.LAST_SYNC_AT, new Date().toISOString());
    lastErrorMsg = null;
    notifyListeners();
    return res.data;
  },

  enqueuePendingMutation(
    action: SheetsApiAction,
    payload: Record<string, unknown>,
    entityKey?: string
  ) {
    const queue = readPendingQueue();
    const filtered = entityKey
      ? queue.filter((item) => !(item.entityKey === entityKey && item.action === action))
      : queue;
    filtered.push({
      queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      entityKey,
      payload,
      createdAt: new Date().toISOString(),
    });
    writePendingQueue(filtered);
  },

  async enqueueAndSync(
    action: SheetsApiAction,
    payload: Record<string, unknown>,
    entityKey?: string
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueuePendingMutation(action, payload, entityKey);
      lastErrorMsg = 'Offline — perubahan disimpan di antrean sinkronisasi.';
      notifyListeners();
      return false;
    }

    isSyncingFlag = true;
    notifyListeners();
    try {
      // Flush any earlier queued items first to preserve causal ordering
      if (readPendingQueue().length > 0) {
        await this.flushPendingQueue();
      }
      await this.postAction(action, payload);
      lastErrorMsg = null;
      return true;
    } catch (err) {
      this.enqueuePendingMutation(action, payload, entityKey);
      lastErrorMsg =
        err instanceof Error ? err.message : 'Gagal kirim ke Spreadsheet, disimpan di antrean.';
      return false;
    } finally {
      isSyncingFlag = false;
      notifyListeners();
    }
  },

  async flushPendingQueue(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (flushInFlight) return flushInFlight;

    flushInFlight = (async () => {
      const queue = readPendingQueue();
      if (queue.length === 0) return true;

      isSyncingFlag = true;
      notifyListeners();

      let remaining = [...queue];
      try {
        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          await this.postAction(item.action, item.payload);
          remaining = remaining.slice(1);
          writePendingQueue(remaining);
        }
        lastErrorMsg = null;
        return true;
      } catch (err) {
        writePendingQueue(remaining);
        lastErrorMsg =
          err instanceof Error ? err.message : 'Sebagian antrean belum terkirim ke Spreadsheet.';
        return false;
      } finally {
        isSyncingFlag = false;
        flushInFlight = null;
        notifyListeners();
      }
    })();

    return flushInFlight;
  },

  async pushAllLocalToSheets(): Promise<SheetsBootstrapData | null> {
    if (!this.isConfigured()) return null;
    isSyncingFlag = true;
    lastErrorMsg = null;
    notifyListeners();

    try {
      const backupJson = StorageService.exportAllData();
      const result = (await this.postAction('syncAll', {
        backup: backupJson,
      })) as SheetsBootstrapData | null;

      writePendingQueue([]);
      if (result?.spreadsheetUrl) {
        safeLocalSet(STORAGE_KEYS.SPREADSHEET_URL, result.spreadsheetUrl);
      }
      safeLocalSet(STORAGE_KEYS.LAST_SYNC_AT, new Date().toISOString());
      lastErrorMsg = null;
      return result;
    } catch (err) {
      lastErrorMsg =
        err instanceof Error ? err.message : 'Gagal mengirim data lokal ke Google Spreadsheet.';
      throw err;
    } finally {
      isSyncingFlag = false;
      notifyListeners();
    }
  },
};
