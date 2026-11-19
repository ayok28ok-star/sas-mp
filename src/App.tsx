import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { RightSidebar } from './components/RightSidebar';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { FaceScannerView } from './components/FaceScannerView';
import { StudentManager } from './components/StudentManager';
import { AttendanceReport } from './components/AttendanceReport';
import { WhatsAppManager } from './components/WhatsAppManager';
import { SettingsView } from './components/SettingsView';
import { ScheduleManager } from './components/ScheduleManager';
import { StudentProgressReport } from './components/StudentProgressReport';
import { StudentCardModal } from './components/StudentCardModal';
import { LoginView } from './components/LoginView';
import { ThemeProvider } from './context/ThemeContext';
import { StorageService } from './services/storage';
import { SheetsBootstrapData, SheetsSyncService } from './services/sheetsSync';
import { syncFaviconWithSchoolLogo } from './utils/favicon';
import { AutoInstallOverlay, InstallSuccessToast, OfflineIndicator } from './components/PWAInstallUI';
import {
  AttendanceRecord,
  AuthUser,
  ClassSchedule,
  NotificationLog,
  RegisteredUser,
  SchoolClass,
  SchoolSettings,
  Student,
  Subject,
  Teacher,
  WhatsAppTemplate,
} from './types/attendance';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Core state from persistent storage
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  // Classes, Subjects, Teachers, Schedules
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const lastSyncTimestampRef = useRef<number>(0);

  // Navigation targets
  const [activeScheduleSession, setActiveScheduleSession] = useState<ClassSchedule | null>(null);
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<string | undefined>(undefined);

  // Modals state
  const [cardModalStudent, setCardModalStudent] = useState<Student | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [blastFilterTarget, setBlastFilterTarget] = useState<'absent' | 'late' | null>(null);

  const applyRemoteBootstrap = useCallback((remote: SheetsBootstrapData) => {
    SheetsSyncService.applyBootstrapToLocalStorage(remote);
    if (Array.isArray(remote.students)) setStudents(remote.students);
    if (Array.isArray(remote.records)) setRecords(remote.records);
    if (remote.settings) setSettings(remote.settings);
    if (Array.isArray(remote.templates)) setTemplates(remote.templates);
    if (Array.isArray(remote.logs)) setLogs(remote.logs);
    if (Array.isArray(remote.classes)) setClasses(remote.classes);
    if (Array.isArray(remote.subjects)) setSubjects(remote.subjects);
    if (Array.isArray(remote.teachers)) setTeachers(remote.teachers);
    if (Array.isArray(remote.schedules)) setSchedules(remote.schedules);
    if (Array.isArray(remote.registeredUsers)) setRegisteredUsers(remote.registeredUsers);
  }, []);

  const syncWithGoogleSheets = useCallback(async (): Promise<boolean> => {
    if (!SheetsSyncService.isConfigured()) return false;
    try {
      await SheetsSyncService.flushPendingQueue();
      const remote = await SheetsSyncService.fetchBootstrapFromSheets();
      if (remote) {
        applyRemoteBootstrap(remote);
        lastSyncTimestampRef.current = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [applyRemoteBootstrap]);

  const pushLocalToGoogleSheets = useCallback(async (): Promise<boolean> => {
    if (!SheetsSyncService.isConfigured()) return false;
    try {
      const remote = await SheetsSyncService.pushAllLocalToSheets();
      if (remote) {
        applyRemoteBootstrap(remote);
        lastSyncTimestampRef.current = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [applyRemoteBootstrap]);

  // Initialize data from local cache first, then synchronize automatically with Google Sheets
  useEffect(() => {
    const loadedStudents = StorageService.getStudents();
    const loadedSettings = StorageService.getSettings();
    const loadedTemplates = StorageService.getTemplates();
    const loadedRecords = StorageService.getRecords();
    const loadedLogs = StorageService.getLogs();
    const loadedClasses = StorageService.getClasses();
    const loadedSubjects = StorageService.getSubjects();
    const loadedTeachers = StorageService.getTeachers();
    const loadedSchedules = StorageService.getSchedules();
    const loadedRegisteredUsers = StorageService.getRegisteredUsers();
    const loadedAuthUser = StorageService.getAuthUser();

    setStudents(loadedStudents);
    setSettings(loadedSettings);
    setTemplates(loadedTemplates);
    setRecords(loadedRecords);
    setLogs(loadedLogs);
    setClasses(loadedClasses);
    setSubjects(loadedSubjects);
    setTeachers(loadedTeachers);
    setSchedules(loadedSchedules);
    setRegisteredUsers(loadedRegisteredUsers);
    setAuthUser(loadedAuthUser);

    void syncWithGoogleSheets();
  }, [syncWithGoogleSheets]);

  // Keep devices synchronized on network reconnect or tab focus
  useEffect(() => {
    const handleOnline = () => {
      void syncWithGoogleSheets();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastSyncTimestampRef.current;
        if (elapsed > 20_000) {
          void syncWithGoogleSheets();
        }
      }
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncWithGoogleSheets]);

  // Sync browser favicon with the saved school logo in settings
  useEffect(() => {
    if (!settings) return;
    syncFaviconWithSchoolLogo(settings.schoolLogo);
  }, [settings?.schoolLogo]);

  // Today string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's records
  const todayRecords = useMemo(
    () => records.filter((r) => r.date === todayStr),
    [records, todayStr]
  );

  const templateMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    templates.forEach((t) => {
      map[t.type] = t.text;
    });
    return map;
  }, [templates]);

  // Handler for adding / updating attendance record (from scanner or manual)
  const handleRecordAttendance = (newRecord: AttendanceRecord) => {
    setRecords((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.id === newRecord.id ||
          (r.studentId === newRecord.studentId &&
            r.date === newRecord.date &&
            r.scheduleId === newRecord.scheduleId)
      );
      let updated: AttendanceRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = newRecord;
      } else {
        updated = [newRecord, ...prev];
      }
      StorageService.saveRecords(updated);
      return updated;
    });

    void SheetsSyncService.enqueueAndSync(
      'recordAttendance',
      { record: newRecord },
      `rec:${newRecord.id}`
    );

    // Add log entry if WhatsApp was marked sent
    if (newRecord.whatsappNotification.sent) {
      const newLog: NotificationLog = {
        id: `log-${Date.now()}-${newRecord.studentId}`,
        timestamp:
          newRecord.whatsappNotification.sentAt || `${newRecord.date} ${newRecord.checkInTime}`,
        studentName: newRecord.studentName,
        studentClass: newRecord.studentClass,
        parentName: newRecord.parentName,
        recipientPhone: newRecord.parentPhone,
        messageType:
          newRecord.status === 'hadir_tepat'
            ? 'Presensi Tepat Waktu'
            : newRecord.status === 'terlambat'
            ? 'Presensi Terlambat'
            : 'Pemberitahuan Izin/Sakit',
        content:
          newRecord.whatsappNotification.message || `Laporan kehadiran status: ${newRecord.status}`,
        status: newRecord.whatsappNotification.status,
      };
      setLogs((prev) => {
        const updated = [newLog, ...prev];
        StorageService.saveLogs(updated);
        return updated;
      });
    }
  };

  // Student management handlers
  const handleAddStudent = (newStudent: Student): Promise<boolean> => {
    const updated = [newStudent, ...students];
    setStudents(updated);
    StorageService.saveStudents(updated);
    return SheetsSyncService.enqueueAndSync('saveStudent', { student: newStudent }, `std:${newStudent.id}`);
  };

  const handleUpdateStudent = (updatedStudent: Student): Promise<boolean> => {
    const updated = students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
    setStudents(updated);
    StorageService.saveStudents(updated);
    return SheetsSyncService.enqueueAndSync('saveStudent', { student: updatedStudent }, `std:${updatedStudent.id}`);
  };

  const handleDeleteStudent = (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    StorageService.saveStudents(updated);
    void SheetsSyncService.enqueueAndSync('deleteStudent', { id }, `std:${id}`);
  };

  const handleDeleteAllStudents = () => {
    setStudents([]);
    StorageService.saveStudents([]);
    void SheetsSyncService.enqueueAndSync('deleteAllStudents', {}, 'std:all');
  };

  // Class CRUD
  const handleAddClass = (cls: SchoolClass) => {
    const updated = [...classes, cls];
    setClasses(updated);
    StorageService.saveClasses(updated);
    void SheetsSyncService.enqueueAndSync('saveClass', { item: cls }, `cls:${cls.id}`);
  };
  const handleUpdateClass = (cls: SchoolClass) => {
    const updated = classes.map((c) => (c.id === cls.id ? cls : c));
    setClasses(updated);
    StorageService.saveClasses(updated);
    void SheetsSyncService.enqueueAndSync('saveClass', { item: cls }, `cls:${cls.id}`);
  };
  const handleDeleteClass = (id: string) => {
    const updated = classes.filter((c) => c.id !== id);
    setClasses(updated);
    StorageService.saveClasses(updated);
    void SheetsSyncService.enqueueAndSync('deleteClass', { id }, `cls:${id}`);
  };
  const handleDeleteAllClasses = () => {
    setClasses([]);
    StorageService.saveClasses([]);
    void SheetsSyncService.enqueueAndSync('deleteAllClasses', {}, 'cls:all');
  };

  // Subject CRUD
  const handleAddSubject = (sbj: Subject) => {
    const updated = [...subjects, sbj];
    setSubjects(updated);
    StorageService.saveSubjects(updated);
    void SheetsSyncService.enqueueAndSync('saveSubject', { item: sbj }, `sbj:${sbj.id}`);
  };
  const handleUpdateSubject = (sbj: Subject) => {
    const updated = subjects.map((s) => (s.id === sbj.id ? sbj : s));
    setSubjects(updated);
    StorageService.saveSubjects(updated);
    void SheetsSyncService.enqueueAndSync('saveSubject', { item: sbj }, `sbj:${sbj.id}`);
  };
  const handleDeleteSubject = (id: string) => {
    const updated = subjects.filter((s) => s.id !== id);
    setSubjects(updated);
    StorageService.saveSubjects(updated);
    void SheetsSyncService.enqueueAndSync('deleteSubject', { id }, `sbj:${id}`);
  };
  const handleDeleteAllSubjects = () => {
    setSubjects([]);
    StorageService.saveSubjects([]);
    void SheetsSyncService.enqueueAndSync('deleteAllSubjects', {}, 'sbj:all');
  };

  // Teacher CRUD
  const handleAddTeacher = (tch: Teacher) => {
    const updated = [...teachers, tch];
    setTeachers(updated);
    StorageService.saveTeachers(updated);
    void SheetsSyncService.enqueueAndSync('saveTeacher', { item: tch }, `tch:${tch.id}`);
  };
  const handleUpdateTeacher = (tch: Teacher) => {
    const updated = teachers.map((t) => (t.id === tch.id ? tch : t));
    setTeachers(updated);
    StorageService.saveTeachers(updated);
    void SheetsSyncService.enqueueAndSync('saveTeacher', { item: tch }, `tch:${tch.id}`);
  };
  const handleDeleteTeacher = (id: string) => {
    const updated = teachers.filter((t) => t.id !== id);
    setTeachers(updated);
    StorageService.saveTeachers(updated);
    void SheetsSyncService.enqueueAndSync('deleteTeacher', { id }, `tch:${id}`);
  };
  const handleDeleteAllTeachers = () => {
    setTeachers([]);
    StorageService.saveTeachers([]);
    void SheetsSyncService.enqueueAndSync('deleteAllTeachers', {}, 'tch:all');
  };

  // Schedule CRUD
  const handleAddSchedule = (sch: ClassSchedule) => {
    const updated = [...schedules, sch];
    setSchedules(updated);
    StorageService.saveSchedules(updated);
    void SheetsSyncService.enqueueAndSync('saveSchedule', { item: sch }, `sch:${sch.id}`);
  };
  const handleUpdateSchedule = (sch: ClassSchedule) => {
    const updated = schedules.map((s) => (s.id === sch.id ? sch : s));
    setSchedules(updated);
    StorageService.saveSchedules(updated);
    void SheetsSyncService.enqueueAndSync('saveSchedule', { item: sch }, `sch:${sch.id}`);
  };
  const handleDeleteSchedule = (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    setSchedules(updated);
    StorageService.saveSchedules(updated);
    void SheetsSyncService.enqueueAndSync('deleteSchedule', { id }, `sch:${id}`);
  };
  const handleDeleteAllSchedules = () => {
    setSchedules([]);
    StorageService.saveSchedules([]);
    void SheetsSyncService.enqueueAndSync('deleteAllSchedules', {}, 'sch:all');
  };

  // Bulk delete attendance records
  const handleDeleteStudentRecords = (studentId: string) => {
    const updated = records.filter((r) => r.studentId !== studentId);
    setRecords(updated);
    StorageService.saveRecords(updated);
    void SheetsSyncService.enqueueAndSync(
      'deleteStudentRecords',
      { studentId },
      `rec:std:${studentId}`
    );
  };

  const handleDeleteRecordsByDate = (date: string) => {
    const updated = records.filter((r) => r.date !== date);
    setRecords(updated);
    StorageService.saveRecords(updated);
    void SheetsSyncService.enqueueAndSync('deleteRecordsByDate', { date }, `rec:date:${date}`);
  };

  const handleDeleteAllRecords = () => {
    setRecords([]);
    StorageService.saveRecords([]);
    void SheetsSyncService.enqueueAndSync('deleteAllRecords', {}, 'rec:all');
  };

  // Trigger subject attendance session from schedule
  const handleStartSubjectAttendance = (schedule: ClassSchedule) => {
    setActiveScheduleSession(schedule);
    setCurrentTab('scanner');
  };

  // Settings handler
  const handleSaveSettings = (newSettings: SchoolSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
    void SheetsSyncService.enqueueAndSync('saveSettings', { settings: newSettings }, 'settings');
  };

  // Template handler
  const handleUpdateTemplate = (updatedTemplate: WhatsAppTemplate) => {
    const updated = templates.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t));
    setTemplates(updated);
    StorageService.saveTemplates(updated);
    void SheetsSyncService.enqueueAndSync('saveTemplate', { template: updatedTemplate }, `tmpl:${updatedTemplate.id}`);
  };

  const handleAddLog = (log: NotificationLog) => {
    setLogs((prev) => {
      const updated = [log, ...prev];
      StorageService.saveLogs(updated);
      return updated;
    });
    void SheetsSyncService.enqueueAndSync('addNotificationLog', { log }, `log:${log.id}`);
  };

  const handleRegisterUser = (newUser: RegisteredUser) => {
    const updated = StorageService.addRegisteredUser(newUser);
    setRegisteredUsers(updated);
    void SheetsSyncService.enqueueAndSync('registerUser', { user: newUser }, `usr:${newUser.id}`);
  };

  // Reset to initial demo
  const handleResetData = async () => {
    if (SheetsSyncService.isConfigured()) {
      try {
        await SheetsSyncService.postAction('resetDemoData');
      } catch {
        // continue local reset even if offline
      }
    }
    StorageService.resetToDefault();
  };

  // Open WhatsApp blast directly with filter
  const handleOpenWhatsAppBlast = (filter: 'absent' | 'late') => {
    setBlastFilterTarget(filter);
    setCurrentTab('whatsapp');
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    StorageService.saveAuthUser(user);
    if (user.role === 'Siswa') {
      const matched = students.find((s) => s.nis === user.username);
      if (matched) {
        setSelectedStudentForProgress(matched.id);
      }
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    StorageService.clearAuthUser();
    setCurrentTab('dashboard');
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Memuat SAS (Sistem Absensi Siswa)...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      {!authUser ? (
        <LoginView
          settings={settings}
          students={students}
          registeredUsers={registeredUsers}
          onRegisterUser={handleRegisterUser}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-200">
          {/* Top Navbar Contract with Theme Selector */}
          <Navbar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setBlastFilterTarget(null);
              setCurrentTab(tab);
            }}
            settings={settings}
            todayCount={
              todayRecords.filter((r) => r.status === 'hadir_tepat' || r.status === 'terlambat').length
            }
            totalStudents={students.length}
            authUser={authUser}
            onLogout={handleLogout}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          />

          {/* Left Sidebar + Workspace */}
          <div className="flex-1 flex relative">
            <RightSidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setBlastFilterTarget(null);
                setCurrentTab(tab);
              }}
              settings={settings}
              todayCount={
                todayRecords.filter((r) => r.status === 'hadir_tepat' || r.status === 'terlambat').length
              }
              totalStudents={students.length}
              authUser={authUser}
              onLogout={handleLogout}
            />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
          {currentTab === 'dashboard' && (
            <AnalyticsDashboard
              students={students}
              records={records}
              settings={settings}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              onOpenQuickScan={() => setCurrentTab('scanner')}
              onOpenWhatsAppBlast={handleOpenWhatsAppBlast}
            />
          )}

          {currentTab === 'scanner' && (
            <FaceScannerView
              students={students}
              settings={settings}
              todayRecords={todayRecords}
              onRecordAttendance={handleRecordAttendance}
              onUpdateStudent={handleUpdateStudent}
              templates={templateMap}
              schedules={schedules}
              activeScheduleId={activeScheduleSession?.id}
            />
          )}

          {currentTab === 'schedule' && (
            <ScheduleManager
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              schedules={schedules}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              onDeleteAllClasses={handleDeleteAllClasses}
              onAddSubject={handleAddSubject}
              onUpdateSubject={handleUpdateSubject}
              onDeleteSubject={handleDeleteSubject}
              onDeleteAllSubjects={handleDeleteAllSubjects}
              onAddTeacher={handleAddTeacher}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onDeleteAllTeachers={handleDeleteAllTeachers}
              onAddSchedule={handleAddSchedule}
              onUpdateSchedule={handleUpdateSchedule}
              onDeleteSchedule={handleDeleteSchedule}
              onDeleteAllSchedules={handleDeleteAllSchedules}
              onStartSubjectAttendance={handleStartSubjectAttendance}
            />
          )}

          {currentTab === 'students' && (
            <StudentManager
              students={students}
              classes={classes}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onDeleteAllStudents={handleDeleteAllStudents}
              onOpenCardModal={(student) => {
                setCardModalStudent(student);
                setIsCardModalOpen(true);
              }}
              onViewProgress={(studentId) => {
                setSelectedStudentForProgress(studentId);
                setCurrentTab('progress');
              }}
              onOpenSettings={() => setCurrentTab('settings')}
              onSyncSheetsNow={syncWithGoogleSheets}
              settings={settings}
            />
          )}

          {currentTab === 'progress' && (
            <StudentProgressReport
              students={students}
              records={records}
              settings={settings}
              selectedStudentId={selectedStudentForProgress}
              onDeleteStudentRecords={handleDeleteStudentRecords}
            />
          )}

          {currentTab === 'reports' && (
            <AttendanceReport
              records={records}
              students={students}
              settings={settings}
              onAddManualRecord={handleRecordAttendance}
              onDeleteAllRecords={handleDeleteAllRecords}
              onDeleteRecordsByDate={handleDeleteRecordsByDate}
              templates={templateMap}
            />
          )}

          {currentTab === 'whatsapp' && (
            <WhatsAppManager
              students={students}
              records={records}
              templates={templates}
              onUpdateTemplate={handleUpdateTemplate}
              logs={logs}
              onAddLog={handleAddLog}
              settings={settings}
              defaultBlastFilter={blastFilterTarget}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onResetData={handleResetData}
              onSyncSheetsNow={syncWithGoogleSheets}
              onPushLocalToSheets={pushLocalToGoogleSheets}
            />
          )}
            </main>
          </div>

        {/* Printable ID Card Modal */}
        {isCardModalOpen && (
          <StudentCardModal
            students={students}
            selectedStudent={cardModalStudent}
            onClose={() => {
              setIsCardModalOpen(false);
              setCardModalStudent(null);
            }}
            settings={settings}
          />
        )}
      </div>
      )}
      <AutoInstallOverlay
        schoolName={settings.schoolName}
        schoolLogo={settings.schoolLogo}
      />
      <InstallSuccessToast />
      <OfflineIndicator />
    </ThemeProvider>
  );
}

