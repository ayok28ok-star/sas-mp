import { AppTheme, ClassSchedule, SchoolClass, Subject, Teacher } from '../types/attendance';

export const availableThemes: AppTheme[] = [
  {
    id: 'theme-emerald',
    name: 'Emerald Hijau Zamrud',
    description: 'Skema default pendidikan resmi bernuansa segar dan bersahaja',
    primary: 'emerald',
    primaryClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    accentClass: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    gradientClass: 'from-emerald-600 to-teal-700',
    previewColor: '#059669',
  },
  {
    id: 'theme-ocean',
    name: 'Ocean Biru Bahari',
    description: 'Biru navy maritim Indonesia yang profesional dan berwibawa',
    primary: 'blue',
    primaryClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    accentClass: 'text-blue-700 bg-blue-50 border-blue-200/60',
    badgeClass: 'bg-blue-100 text-blue-800',
    gradientClass: 'from-blue-600 to-indigo-800',
    previewColor: '#2563eb',
  },
  {
    id: 'theme-indigo',
    name: 'Royal Indigo',
    description: 'Ungu indigo modern yang elegan untuk lingkungan sains dan teknologi',
    primary: 'indigo',
    primaryClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    accentClass: 'text-indigo-700 bg-indigo-50 border-indigo-200/60',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    gradientClass: 'from-indigo-600 to-purple-800',
    previewColor: '#4f46e5',
  },
  {
    id: 'theme-teal',
    name: 'Forest Teal Tropis',
    description: 'Kombinasi hijau-biru teal yang sejuk, fokus, dan nyaman di mata',
    primary: 'teal',
    primaryClass: 'bg-teal-600 hover:bg-teal-700 text-white',
    accentClass: 'text-teal-700 bg-teal-50 border-teal-200/60',
    badgeClass: 'bg-teal-100 text-teal-800',
    gradientClass: 'from-teal-600 to-emerald-800',
    previewColor: '#0d9488',
  },
  {
    id: 'theme-crimson',
    name: 'Crimson Merah Almamater',
    description: 'Nuansa marun berenergi tinggi yang mencerminkan semangat belajar',
    primary: 'rose',
    primaryClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    accentClass: 'text-rose-700 bg-rose-50 border-rose-200/60',
    badgeClass: 'bg-rose-100 text-rose-800',
    gradientClass: 'from-rose-600 to-red-800',
    previewColor: '#e11d48',
  },
  {
    id: 'theme-slate',
    name: 'Slate Monokrom Minimalis',
    description: 'Gaya monokromatis bersih kontras tinggi untuk efisiensi visual maksimal',
    primary: 'slate',
    primaryClass: 'bg-slate-900 hover:bg-slate-800 text-white',
    accentClass: 'text-slate-800 bg-slate-100 border-slate-300',
    badgeClass: 'bg-slate-200 text-slate-800',
    gradientClass: 'from-slate-800 to-slate-950',
    previewColor: '#1e293b',
  },
];

export const defaultTeachers: Teacher[] = [];

export const defaultSubjects: Subject[] = [];

export const defaultClasses: SchoolClass[] = [];

export const defaultSchedules: ClassSchedule[] = [];
