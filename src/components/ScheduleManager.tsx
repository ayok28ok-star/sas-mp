import React, { useState } from 'react';
import {
  Calendar,
  BookOpen,
  GraduationCap,
  Users,
  Plus,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  Check,
  X,
  Play,
  Search,
  Filter,
  Phone,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ClassSchedule, SchoolClass, Subject, Teacher } from '../types/attendance';

interface ScheduleManagerProps {
  classes: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  schedules: ClassSchedule[];
  onAddClass: (cls: SchoolClass) => void;
  onUpdateClass: (cls: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onDeleteAllClasses: () => void;
  onAddSubject: (sbj: Subject) => void;
  onUpdateSubject: (sbj: Subject) => void;
  onDeleteSubject: (id: string) => void;
  onDeleteAllSubjects: () => void;
  onAddTeacher: (tch: Teacher) => void;
  onUpdateTeacher: (tch: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onDeleteAllTeachers: () => void;
  onAddSchedule: (sch: ClassSchedule) => void;
  onUpdateSchedule: (sch: ClassSchedule) => void;
  onDeleteSchedule: (id: string) => void;
  onDeleteAllSchedules: () => void;
  onStartSubjectAttendance: (schedule: ClassSchedule) => void;
}

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  classes,
  subjects,
  teachers,
  schedules,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onDeleteAllClasses,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onDeleteAllSubjects,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onDeleteAllTeachers,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onDeleteAllSchedules,
  onStartSubjectAttendance,
}) => {
  const [activeTab, setActiveTab] = useState<
    'schedules' | 'classes' | 'subjects' | 'teachers' | 'piket'
  >('schedules');

  // Filters for schedule & piket views
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterPiketDay, setFilterPiketDay] = useState<string>('all');

  // Modal states
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const [isPiketModalOpen, setIsPiketModalOpen] = useState(false);
  const [editingPiketTeacher, setEditingPiketTeacher] = useState<Teacher | null>(null);
  const [selectedExistingTeacherId, setSelectedExistingTeacherId] = useState<string>('');

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [scheduleFormError, setScheduleFormError] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Form states
  const [classForm, setClassForm] = useState<Partial<SchoolClass>>({
    name: '',
    gradeLevel: 'VII',
    major: 'Reguler',
    roomNumber: '',
    capacity: 32,
    homeroomTeacherId: '',
  });

  const [subjectForm, setSubjectForm] = useState<Partial<Subject>>({
    code: '',
    name: '',
    category: 'Wajib',
    hoursPerWeek: 4,
    color: 'emerald',
  });

  const [teacherForm, setTeacherForm] = useState<Partial<Teacher>>({
    nip: '',
    name: '',
    gender: 'L',
    phone: '628',
    email: '',
    subjectSpecialties: [],
    isDutyTeacher: false,
    dutyDays: [],
    dutyShift: 'Gerbang Pagi & Harian (06:30 - 15:00)',
  });

  const [piketForm, setPiketForm] = useState<{
    name: string;
    nip: string;
    gender: 'L' | 'P';
    phone: string;
    email: string;
    dutyDays: ClassSchedule['dayOfWeek'][];
    dutyShift: string;
  }>({
    name: '',
    nip: '',
    gender: 'L',
    phone: '628',
    email: '',
    dutyDays: ['Senin'],
    dutyShift: 'Gerbang Pagi & Harian (06:30 - 15:00)',
  });

  const [scheduleForm, setScheduleForm] = useState<Partial<ClassSchedule>>({
    classId: classes[0]?.id || '',
    subjectId: subjects[0]?.id || '',
    teacherId: teachers[0]?.id || '',
    dutyTeacherId: '',
    dayOfWeek: 'Senin',
    startTime: '07:30',
    endTime: '09:00',
    room: '',
  });

  const daysList: ClassSchedule['dayOfWeek'][] = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
  ];

  // Duty teachers (Guru Piket)
  const dutyTeachers = teachers.filter((t) => Boolean(t.isDutyTeacher));
  const filteredDutyTeachers = dutyTeachers.filter(
    (t) => filterPiketDay === 'all' || (t.dutyDays || []).includes(filterPiketDay as ClassSchedule['dayOfWeek'])
  );

  // Filtered schedules
  const filteredSchedules = schedules.filter((s) => {
    const matchDay = filterDay === 'all' || s.dayOfWeek === filterDay;
    const matchClass = filterClass === 'all' || s.className === filterClass;
    return matchDay && matchClass;
  });

  const toggleDayInList = (
    current: ClassSchedule['dayOfWeek'][] = [],
    day: ClassSchedule['dayOfWeek']
  ): ClassSchedule['dayOfWeek'][] =>
    current.includes(day) ? current.filter((d) => d !== day) : [...current, day];

  // Handler for Class submit
  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name) return;
    const homeroom = teachers.find((t) => t.id === classForm.homeroomTeacherId);
    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        name: classForm.name,
        gradeLevel: classForm.gradeLevel || 'VII',
        major: classForm.major || 'Reguler',
        roomNumber: classForm.roomNumber || '',
        capacity: Number(classForm.capacity) || 32,
        homeroomTeacherId: classForm.homeroomTeacherId || '',
        homeroomTeacherName: homeroom?.name || 'Belum Ditetapkan',
      });
    } else {
      onAddClass({
        id: `cls-${Date.now()}`,
        name: classForm.name,
        gradeLevel: classForm.gradeLevel || 'VII',
        major: classForm.major || 'Reguler',
        roomNumber: classForm.roomNumber || '',
        capacity: Number(classForm.capacity) || 32,
        homeroomTeacherId: classForm.homeroomTeacherId || '',
        homeroomTeacherName: homeroom?.name || 'Belum Ditetapkan',
      });
    }
    setIsClassModalOpen(false);
  };

  // Handler for Subject submit
  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.code) return;
    if (editingSubject) {
      onUpdateSubject({
        ...editingSubject,
        name: subjectForm.name,
        code: subjectForm.code,
        category: subjectForm.category || 'Wajib',
        hoursPerWeek: Number(subjectForm.hoursPerWeek) || 3,
        color: subjectForm.color || 'blue',
      });
    } else {
      onAddSubject({
        id: `sbj-${Date.now()}`,
        name: subjectForm.name,
        code: subjectForm.code,
        category: subjectForm.category || 'Wajib',
        hoursPerWeek: Number(subjectForm.hoursPerWeek) || 3,
        color: subjectForm.color || 'blue',
      });
    }
    setIsSubjectModalOpen(false);
  };

  // Handler for Teacher submit
  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name) return;
    if (editingTeacher) {
      onUpdateTeacher({
        ...editingTeacher,
        name: teacherForm.name,
        nip: teacherForm.nip || '-',
        gender: teacherForm.gender || 'L',
        phone: teacherForm.phone || '',
        email: teacherForm.email || '',
        subjectSpecialties: teacherForm.subjectSpecialties || [],
        isDutyTeacher: Boolean(teacherForm.isDutyTeacher),
        dutyDays: teacherForm.isDutyTeacher ? teacherForm.dutyDays || [] : [],
        dutyShift: teacherForm.isDutyTeacher ? teacherForm.dutyShift || 'Gerbang Pagi & Harian (06:30 - 15:00)' : '',
      });
    } else {
      onAddTeacher({
        id: `tch-${Date.now()}`,
        name: teacherForm.name,
        nip: teacherForm.nip || '-',
        gender: teacherForm.gender || 'L',
        phone: teacherForm.phone || '',
        email: teacherForm.email || '',
        subjectSpecialties: teacherForm.subjectSpecialties || [],
        isDutyTeacher: Boolean(teacherForm.isDutyTeacher),
        dutyDays: teacherForm.isDutyTeacher ? teacherForm.dutyDays || [] : [],
        dutyShift: teacherForm.isDutyTeacher ? teacherForm.dutyShift || 'Gerbang Pagi & Harian (06:30 - 15:00)' : '',
      });
    }
    setIsTeacherModalOpen(false);
  };

  // Handler for Guru Piket submit
  const handleSavePiketTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!piketForm.name.trim()) return;

    const existingTarget =
      editingPiketTeacher ||
      (selectedExistingTeacherId ? teachers.find((t) => t.id === selectedExistingTeacherId) : undefined);

    if (existingTarget) {
      onUpdateTeacher({
        ...existingTarget,
        name: piketForm.name.trim(),
        nip: piketForm.nip.trim() || existingTarget.nip || '-',
        gender: piketForm.gender,
        phone: piketForm.phone.trim(),
        email: piketForm.email.trim(),
        isDutyTeacher: true,
        dutyDays: piketForm.dutyDays,
        dutyShift: piketForm.dutyShift.trim() || 'Gerbang Pagi & Harian (06:30 - 15:00)',
      });
    } else {
      onAddTeacher({
        id: `tch-${Date.now()}`,
        name: piketForm.name.trim(),
        nip: piketForm.nip.trim() || '-',
        gender: piketForm.gender,
        phone: piketForm.phone.trim(),
        email: piketForm.email.trim(),
        subjectSpecialties: [],
        isDutyTeacher: true,
        dutyDays: piketForm.dutyDays,
        dutyShift: piketForm.dutyShift.trim() || 'Gerbang Pagi & Harian (06:30 - 15:00)',
      });
    }
    setIsPiketModalOpen(false);
  };

  const handleRemoveFromPiket = (tch: Teacher) => {
    if (tch.subjectSpecialties && tch.subjectSpecialties.length > 0) {
      onUpdateTeacher({
        ...tch,
        isDutyTeacher: false,
        dutyDays: [],
        dutyShift: '',
      });
    } else {
      onDeleteTeacher(tch.id);
    }
  };

  const handleClearAllPiket = () => {
    dutyTeachers.forEach((tch) => {
      if (tch.subjectSpecialties && tch.subjectSpecialties.length > 0) {
        onUpdateTeacher({
          ...tch,
          isDutyTeacher: false,
          dutyDays: [],
          dutyShift: '',
        });
      } else {
        onDeleteTeacher(tch.id);
      }
    });
  };

  // Handler for Schedule submit
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleFormError(null);
    const selClass = classes.find((c) => c.id === scheduleForm.classId);
    const selSubject = subjects.find((s) => s.id === scheduleForm.subjectId);
    const selTeacher = teachers.find((t) => t.id === scheduleForm.teacherId);
    const selDutyTeacher = teachers.find((t) => t.id === scheduleForm.dutyTeacherId);

    if (!selClass || !selSubject || !selTeacher) {
      setScheduleFormError(
        'Mohon lengkapi Kelas, Mata Pelajaran, dan Guru Pengampu terlebih dahulu (tambahkan datanya di tab terkait bila masih kosong).'
      );
      return;
    }

    if (editingSchedule) {
      onUpdateSchedule({
        ...editingSchedule,
        classId: selClass.id,
        className: selClass.name,
        subjectId: selSubject.id,
        subjectName: selSubject.name,
        teacherId: selTeacher.id,
        teacherName: selTeacher.name,
        dutyTeacherId: selDutyTeacher?.id || '',
        dutyTeacherName: selDutyTeacher?.name || '',
        dayOfWeek: scheduleForm.dayOfWeek || 'Senin',
        startTime: scheduleForm.startTime || '07:30',
        endTime: scheduleForm.endTime || '09:00',
        room: scheduleForm.room || selClass.roomNumber || 'Ruang Kelas',
      });
    } else {
      onAddSchedule({
        id: `sch-${Date.now()}`,
        classId: selClass.id,
        className: selClass.name,
        subjectId: selSubject.id,
        subjectName: selSubject.name,
        teacherId: selTeacher.id,
        teacherName: selTeacher.name,
        dutyTeacherId: selDutyTeacher?.id || '',
        dutyTeacherName: selDutyTeacher?.name || '',
        dayOfWeek: scheduleForm.dayOfWeek || 'Senin',
        startTime: scheduleForm.startTime || '07:30',
        endTime: scheduleForm.endTime || '09:00',
        room: scheduleForm.room || selClass.roomNumber || 'Ruang Kelas',
      });
    }
    setIsScheduleModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Manajemen Kelas &amp; Jadwal Sesi Presensi (SMP)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur rombongan belajar jenjang SMP (Kelas VII, VIII, IX), mata pelajaran, guru pengampu, serta jadwal sesi presensi
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'schedules' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal & Sesi ({schedules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'classes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Daftar Kelas ({classes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'subjects' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Mata Pelajaran ({subjects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'teachers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Guru Pengajar ({teachers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('piket')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'piket' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Guru Piket ({dutyTeachers.length})</span>
          </button>
        </div>
      </div>

      {/* 1. Tab: Jadwal Pelajaran & Sesi Absensi */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          {/* Filters & Add Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Hari:</span>
              </div>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="all">Semua Hari</option>
                {daysList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs text-slate-500 ml-2">
                <span>Kelas:</span>
              </div>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {schedules.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Hapus Semua Jadwal Sesi?',
                      message: `Seluruh ${schedules.length} jadwal sesi presensi akan dihapus permanen dari aplikasi & Google Spreadsheet.`,
                      onConfirm: onDeleteAllSchedules,
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua ({schedules.length})</span>
                </button>
              )}

              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setScheduleFormError(null);
                  setScheduleForm({
                    classId: classes[0]?.id || '',
                    subjectId: subjects[0]?.id || '',
                    teacherId: teachers[0]?.id || '',
                    dutyTeacherId: dutyTeachers[0]?.id || '',
                    dayOfWeek: 'Senin',
                    startTime: '07:30',
                    endTime: '09:00',
                    room: '',
                  });
                  setIsScheduleModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Jadwal Sesi</span>
              </button>
            </div>
          </div>

          {/* Schedule Sessions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchedules.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      {item.dayOfWeek}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700" />
                      {item.startTime} - {item.endTime}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-3">{item.subjectName}</h3>
                  <p className="text-xs font-medium text-emerald-700 mt-0.5">
                    Rombel: {item.className}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.teacherName}</span>
                    </div>
                    {item.dutyTeacherName && (
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Guru Piket: {item.dutyTeacherName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.room}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onStartSubjectAttendance(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Buka Sesi Presensi</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSchedule(item);
                        setScheduleFormError(null);
                        setScheduleForm({
                          classId: item.classId,
                          subjectId: item.subjectId,
                          teacherId: item.teacherId,
                          dutyTeacherId: item.dutyTeacherId || '',
                          dayOfWeek: item.dayOfWeek,
                          startTime: item.startTime,
                          endTime: item.endTime,
                          room: item.room,
                        });
                        setIsScheduleModalOpen(true);
                      }}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Sesi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          title: 'Hapus Jadwal Sesi?',
                          message: `Hapus jadwal ${item.subjectName} untuk kelas ${item.className}?`,
                          confirmLabel: 'Ya, Hapus',
                          onConfirm: () => onDeleteSchedule(item.id),
                        })
                      }
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus Sesi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredSchedules.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Belum ada jadwal mata pelajaran untuk filter hari atau kelas yang dipilih.
            </div>
          )}
        </div>
      )}

      {/* 2. Tab: Manajemen Kelas / Rombel */}
      {activeTab === 'classes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Rombongan Belajar (Kelas)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nama kelas, tingkat jenjang, ruangan, kapasitas maksimal, dan wali kelas
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Hapus Semua Data Kelas?',
                      message: `Seluruh ${classes.length} data rombongan belajar (kelas) akan dihapus permanen dari aplikasi & Google Spreadsheet.`,
                      onConfirm: onDeleteAllClasses,
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua ({classes.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditingClass(null);
                  setClassForm({
                    name: '',
                    gradeLevel: 'VII',
                    major: 'Reguler',
                    roomNumber: '',
                    capacity: 32,
                    homeroomTeacherId: teachers[0]?.id || '',
                  });
                  setIsClassModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rombel Kelas</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Nama Kelas</th>
                  <th className="py-3 px-4">Tingkat SMP</th>
                  <th className="py-3 px-4">Program</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Kapasitas</th>
                  <th className="py-3 px-4">Wali Kelas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{cls.name}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">Kelas {cls.gradeLevel}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {cls.major}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{cls.roomNumber}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{cls.capacity} Siswa</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {cls.homeroomTeacherName}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingClass(cls);
                            setClassForm(cls);
                            setIsClassModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              title: 'Hapus Rombel Kelas?',
                              message: `Hapus rombel ${cls.name}?`,
                              confirmLabel: 'Ya, Hapus',
                              onConfirm: () => onDeleteClass(cls.id),
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-400">
                      Belum ada data rombel kelas. Klik &ldquo;Tambah Rombel Kelas&rdquo; untuk memulai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Tab: Mata Pelajaran */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Mata Pelajaran</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi kurikulum, kode mapel, kategori, dan alokasi jam pelajaran per minggu
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {subjects.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Hapus Semua Mata Pelajaran?',
                      message: `Seluruh ${subjects.length} data mata pelajaran akan dihapus permanen dari aplikasi & Google Spreadsheet.`,
                      onConfirm: onDeleteAllSubjects,
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua ({subjects.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectForm({
                    code: '',
                    name: '',
                    category: 'Wajib',
                    hoursPerWeek: 4,
                    color: 'emerald',
                  });
                  setIsSubjectModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Mata Pelajaran</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Kode Mapel</th>
                  <th className="py-3 px-4">Nama Mata Pelajaran</th>
                  <th className="py-3 px-4">Kategori Kurikulum</th>
                  <th className="py-3 px-4">Alokasi Waktu (JP)</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sbj) => (
                  <tr key={sbj.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{sbj.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{sbj.name}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {sbj.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {sbj.hoursPerWeek} Jam / Minggu
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingSubject(sbj);
                            setSubjectForm(sbj);
                            setIsSubjectModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              title: 'Hapus Mata Pelajaran?',
                              message: `Hapus mapel ${sbj.name}?`,
                              confirmLabel: 'Ya, Hapus',
                              onConfirm: () => onDeleteSubject(sbj.id),
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-xs text-slate-400">
                      Belum ada data mata pelajaran. Klik &ldquo;Tambah Mata Pelajaran&rdquo; untuk memulai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tab: Data Guru & Pengajar */}
      {activeTab === 'teachers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Direktori Guru & Pengampu Sesi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Data tenaga pendidik, NIP resmi, nomor kontak WhatsApp, dan bidang studi pengajaran
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {teachers.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Hapus Semua Data Guru?',
                      message: `Seluruh ${teachers.length} data guru pengajar akan dihapus permanen dari aplikasi & Google Spreadsheet.`,
                      onConfirm: onDeleteAllTeachers,
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua ({teachers.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setTeacherForm({
                    nip: '',
                    name: '',
                    gender: 'L',
                    phone: '628',
                    email: '',
                    subjectSpecialties: [],
                    isDutyTeacher: false,
                    dutyDays: [],
                    dutyShift: 'Gerbang Pagi & Harian (06:30 - 15:00)',
                  });
                  setIsTeacherModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Guru</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Nama Lengkap & Gelar</th>
                  <th className="py-3 px-4">NIP</th>
                  <th className="py-3 px-4">JK</th>
                  <th className="py-3 px-4">Kontak WhatsApp</th>
                  <th className="py-3 px-4">Peran &amp; Mapel</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((tch) => (
                  <tr key={tch.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{tch.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{tch.nip}</td>
                    <td className="py-3 px-4 font-medium text-slate-600">
                      {tch.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700 font-medium">
                      +{tch.phone}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {tch.isDutyTeacher && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Guru Piket</span>
                          </span>
                        )}
                        {tch.subjectSpecialties.map((sp, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded font-medium"
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingTeacher(tch);
                            setTeacherForm({
                              ...tch,
                              isDutyTeacher: Boolean(tch.isDutyTeacher),
                              dutyDays: tch.dutyDays || [],
                              dutyShift: tch.dutyShift || 'Gerbang Pagi & Harian (06:30 - 15:00)',
                            });
                            setIsTeacherModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              title: 'Hapus Data Guru?',
                              message: `Hapus data guru ${tch.name}?`,
                              confirmLabel: 'Ya, Hapus',
                              onConfirm: () => onDeleteTeacher(tch.id),
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {teachers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-400">
                      Belum ada data guru. Klik &ldquo;Tambah Guru&rdquo; untuk memulai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab: Jadwal & Daftar Guru Piket SMP */}
      {activeTab === 'piket' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Daftar &amp; Jadwal Guru Piket (SMP)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola daftar guru piket harian gerbang, pengawasan sesi presensi, hari bertugas, dan kontak WhatsApp piket
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterPiketDay}
                  onChange={(e) => setFilterPiketDay(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
                >
                  <option value="all">Semua Hari Piket</option>
                  {daysList.map((d) => (
                    <option key={d} value={d}>
                      Piket {d}
                    </option>
                  ))}
                </select>
                {dutyTeachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        title: 'Hapus Semua Guru Piket?',
                        message: `Seluruh ${dutyTeachers.length} penugasan guru piket akan dihapus dari daftar Guru Piket.`,
                        onConfirm: handleClearAllPiket,
                      })
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Semua ({dutyTeachers.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingPiketTeacher(null);
                    setSelectedExistingTeacherId('');
                    setPiketForm({
                      name: '',
                      nip: '',
                      gender: 'L',
                      phone: '628',
                      email: '',
                      dutyDays: ['Senin'],
                      dutyShift: 'Gerbang Pagi & Harian (06:30 - 15:00)',
                    });
                    setIsPiketModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Guru Piket</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Nama Guru Piket</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4">Hari Tugas Piket</th>
                    <th className="py-3 px-4">Shift / Area Tugas</th>
                    <th className="py-3 px-4">Kontak WhatsApp</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDutyTeachers.map((tch) => (
                    <tr key={tch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                            <UserCheck className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">{tch.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {tch.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{tch.nip || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(tch.dutyDays && tch.dutyDays.length > 0 ? tch.dutyDays : ['Harian']).map(
                            (day) => (
                              <span
                                key={day}
                                className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[10px] font-bold"
                              >
                                {day}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {tch.dutyShift || 'Gerbang Pagi & Harian'}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-medium">
                        {tch.phone ? `+${tch.phone}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPiketTeacher(tch);
                              setSelectedExistingTeacherId(tch.id);
                              setPiketForm({
                                name: tch.name,
                                nip: tch.nip || '',
                                gender: tch.gender || 'L',
                                phone: tch.phone || '628',
                                email: tch.email || '',
                                dutyDays: tch.dutyDays || ['Senin'],
                                dutyShift: tch.dutyShift || 'Gerbang Pagi & Harian (06:30 - 15:00)',
                              });
                              setIsPiketModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                            title="Edit Guru Piket"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                title: 'Hapus Guru Piket?',
                                message:
                                  tch.subjectSpecialties && tch.subjectSpecialties.length > 0
                                    ? `Keluarkan ${tch.name} dari daftar Guru Piket? (Data guru pengajar tetap tersimpan.)`
                                    : `Hapus data Guru Piket ${tch.name} secara permanen?`,
                                confirmLabel: 'Ya, Hapus',
                                onConfirm: () => handleRemoveFromPiket(tch),
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                            title="Hapus dari Guru Piket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDutyTeachers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-400">
                        Belum ada data Guru Piket untuk hari yang dipilih. Klik &ldquo;Tambah Guru Piket&rdquo; untuk menetapkan guru piket.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Class Add / Edit */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingClass ? 'Edit Rombel Kelas' : 'Tambah Rombel Kelas Baru'}
              </h3>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Rombel *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: VII C"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tingkat Jenjang SMP</label>
                  <select
                    value={classForm.gradeLevel}
                    onChange={(e) =>
                      setClassForm({ ...classForm, gradeLevel: e.target.value as 'VII' | 'VIII' | 'IX' })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="VII">Kelas 7 (VII)</option>
                    <option value="VIII">Kelas 8 (VIII)</option>
                    <option value="IX">Kelas 9 (IX)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Program Kelas</label>
                  <select
                    value={classForm.major}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        major: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Reguler">Reguler</option>
                    <option value="Unggulan">Unggulan</option>
                    <option value="Bilingual">Bilingual</option>
                    <option value="Tahfidz">Tahfidz</option>
                    <option value="Khusus">Khusus</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ruangan Kelas</label>
                  <input
                    type="text"
                    placeholder="Contoh: R. 103"
                    value={classForm.roomNumber}
                    onChange={(e) => setClassForm({ ...classForm, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kapasitas Siswa</label>
                  <input
                    type="number"
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Wali Kelas</label>
                <select
                  value={classForm.homeroomTeacherId}
                  onChange={(e) => setClassForm({ ...classForm, homeroomTeacherId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- Pilih Guru Wali Kelas --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Schedule Add / Edit */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSchedule ? 'Edit Jadwal Sesi Presensi' : 'Jadwalkan Sesi Presensi Baru'}
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pilih Kelas *</label>
                  <select
                    value={scheduleForm.classId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, classId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mata Pelajaran *</label>
                  <select
                    value={scheduleForm.subjectId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, subjectId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Guru Pengampu *</label>
                  <select
                    value={scheduleForm.teacherId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, teacherId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Pilih Guru Pengampu --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Guru Piket Pendamping (Opsional)
                  </label>
                  <select
                    value={scheduleForm.dutyTeacherId || ''}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, dutyTeacherId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Tanpa Guru Piket --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isDutyTeacher ? ' (Guru Piket)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {scheduleFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                  {scheduleFormError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hari Pertemuan</label>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        dayOfWeek: e.target.value as ClassSchedule['dayOfWeek'],
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {daysList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Ruangan / Laboratorium</label>
                <input
                  type="text"
                  placeholder="Contoh: Lab IPA / R. 101"
                  value={scheduleForm.room}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Jadwal Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Subject Add / Edit */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <button
                onClick={() => setIsSubjectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kode Mapel *</label>
                  <input
                    type="text"
                    required
                    placeholder="MAT-01"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={subjectForm.category}
                    onChange={(e) =>
                      setSubjectForm({
                        ...subjectForm,
                        category: e.target.value as 'Wajib' | 'Pilihan' | 'Mulok',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Wajib">Wajib</option>
                    <option value="Pilihan">Pilihan</option>
                    <option value="Mulok">Muatan Lokal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Mata Pelajaran *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ilmu Pengetahuan Alam (IPA)"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Jam Pelajaran per Minggu (JP)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={subjectForm.hoursPerWeek}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, hoursPerWeek: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Teacher Add / Edit */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingTeacher ? 'Edit Data Guru' : 'Tambah Guru Pengajar Baru'}
              </h3>
              <button
                onClick={() => setIsTeacherModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dra. H. Suryani, M.Pd."
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NIP Resmi</label>
                  <input
                    type="text"
                    placeholder="1980xxxx"
                    value={teacherForm.nip}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={teacherForm.gender}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor WhatsApp Guru *</label>
                <input
                  type="text"
                  required
                  placeholder="628123456789"
                  value={teacherForm.phone}
                  onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Resmi</label>
                <input
                  type="email"
                  placeholder="nama.guru@sekolah.sch.id"
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
                <label className="flex items-center gap-2 font-semibold text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(teacherForm.isDutyTeacher)}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        isDutyTeacher: e.target.checked,
                        dutyDays:
                          e.target.checked && (!teacherForm.dutyDays || teacherForm.dutyDays.length === 0)
                            ? ['Senin']
                            : teacherForm.dutyDays || [],
                      })
                    }
                    className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Tetapkan juga sebagai Guru Piket</span>
                </label>

                {teacherForm.isDutyTeacher && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <span className="block text-[11px] font-medium text-emerald-900 mb-1">
                        Hari Piket:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {daysList.map((day) => {
                          const active = (teacherForm.dutyDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() =>
                                setTeacherForm({
                                  ...teacherForm,
                                  dutyDays: toggleDayInList(teacherForm.dutyDays || [], day),
                                })
                              }
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-emerald-900 mb-1">
                        Shift / Area Tugas Piket
                      </label>
                      <input
                        type="text"
                        placeholder="Gerbang Pagi & Harian (06:30 - 15:00)"
                        value={teacherForm.dutyShift || ''}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, dutyShift: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Guru Piket Add / Edit */}
      {isPiketModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{editingPiketTeacher ? 'Edit Guru Piket' : 'Tambah Guru Piket Baru'}</span>
              </h3>
              <button
                onClick={() => setIsPiketModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePiketTeacher} className="mt-4 space-y-3.5 text-xs">
              {!editingPiketTeacher && teachers.length > 0 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Pilih dari Guru Terdaftar (Opsional)
                  </label>
                  <select
                    value={selectedExistingTeacherId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedExistingTeacherId(val);
                      const found = teachers.find((t) => t.id === val);
                      if (found) {
                        setPiketForm({
                          name: found.name,
                          nip: found.nip || '',
                          gender: found.gender || 'L',
                          phone: found.phone || '628',
                          email: found.email || '',
                          dutyDays:
                            found.dutyDays && found.dutyDays.length > 0
                              ? found.dutyDays
                              : ['Senin'],
                          dutyShift:
                            found.dutyShift || 'Gerbang Pagi & Harian (06:30 - 15:00)',
                        });
                      } else {
                        setPiketForm({
                          name: '',
                          nip: '',
                          gender: 'L',
                          phone: '628',
                          email: '',
                          dutyDays: ['Senin'],
                          dutyShift: 'Gerbang Pagi & Harian (06:30 - 15:00)',
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Input Data Guru Piket Baru --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDutyTeacher ? '(Sudah Piket)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Lengkap Guru Piket *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siti Rahmawati, S.Pd."
                  value={piketForm.name}
                  onChange={(e) => setPiketForm({ ...piketForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    placeholder="1982xxxx"
                    value={piketForm.nip}
                    onChange={(e) => setPiketForm({ ...piketForm, nip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={piketForm.gender}
                    onChange={(e) =>
                      setPiketForm({ ...piketForm, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  No. WhatsApp Guru Piket *
                </label>
                <input
                  type="text"
                  required
                  placeholder="628123456789"
                  value={piketForm.phone}
                  onChange={(e) => setPiketForm({ ...piketForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Hari Tugas Piket *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {daysList.map((day) => {
                    const active = piketForm.dutyDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setPiketForm({
                            ...piketForm,
                            dutyDays: toggleDayInList(piketForm.dutyDays, day),
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Shift / Area Tugas Piket
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Gerbang Pagi & Harian (06:30 - 15:00)"
                  value={piketForm.dutyShift}
                  onChange={(e) => setPiketForm({ ...piketForm, dutyShift: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPiketModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Guru Piket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                {confirmDialog.confirmLabel || 'Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
