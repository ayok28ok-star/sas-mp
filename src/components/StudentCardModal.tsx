import React, { useState } from 'react';
import { Printer, ScanFace, ShieldCheck, X } from 'lucide-react';
import { SchoolSettings, Student } from '../types/attendance';
import { SchoolLogo } from './SchoolLogo';

interface StudentCardModalProps {
  students: Student[];
  selectedStudent: Student | null;
  onClose: () => void;
  settings: SchoolSettings;
}

export const StudentCardModal: React.FC<StudentCardModalProps> = ({
  students,
  selectedStudent,
  onClose,
  settings,
}) => {
  const [printMode, setPrintMode] = useState<'single' | 'batch'>(
    selectedStudent ? 'single' : 'batch'
  );
  const [targetClass, setTargetClass] = useState<string>('all');

  const displayList =
    printMode === 'single' && selectedStudent
      ? [selectedStudent]
      : students.filter((s) => targetClass === 'all' || s.studentClass === targetClass);

  const uniqueClasses = Array.from(new Set(students.map((s) => s.studentClass))).sort();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Top Header (No print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Kartu Tanda Pelajar Biometrik Wajah (Format Portrait)
              </h2>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Portrait 3:4
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tata letak tegak (portrait) standar kartu pelajar ID badge dengan foto wajah &amp; status verifikasi biometrik
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode selection if batch opened */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setPrintMode('single')}
                disabled={!selectedStudent}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  printMode === 'single' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                }`}
              >
                Siswa Ini
              </button>
              <button
                onClick={() => setPrintMode('batch')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  printMode === 'batch' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                }`}
              >
                Cetak Massal
              </button>
            </div>

            {printMode === 'batch' && (
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
              >
                <option value="all">Semua Kelas ({students.length})</option>
                {uniqueClasses.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Cards Grid (Portrait 3-up) */}
        <div className="overflow-y-auto p-6 bg-slate-100 print:bg-white print:p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print-container justify-items-center">
            {displayList.map((student) => {
              const hasFace =
                Array.isArray(student.faceDescriptor) && student.faceDescriptor.length === 128;

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-300 shadow-md print:shadow-none print:border print:border-slate-800 break-inside-avoid flex flex-col justify-between"
                  style={{
                    width: '100%',
                    maxWidth: '310px',
                    minHeight: '480px',
                    margin: '0 auto',
                  }}
                >
                  {/* Top Slot Hole for Badge Lanyard */}
                  <div className="pt-2 pb-1 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 flex justify-center">
                    <div className="w-12 h-2 rounded-full bg-slate-950/60 border border-white/20 shadow-inner" />
                  </div>

                  {/* Card Header (Official Indonesian High School Styling - Portrait) */}
                  <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-3 pt-1 border-b-2 border-amber-400 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <SchoolLogo
                        logoUrl={settings.schoolLogo}
                        schoolName={settings.schoolName}
                        className="w-8 h-8 rounded-full bg-white border border-amber-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs"
                        imgClassName="w-full h-full object-contain p-0.5"
                        fallbackIconClassName="w-4 h-4 text-blue-900"
                      />
                      <div className="text-left leading-none">
                        <p className="text-[8px] font-semibold tracking-wider text-slate-300 uppercase">
                          Dinas Pendidikan DKI Jakarta
                        </p>
                        <h4 className="text-[11px] font-extrabold tracking-tight text-white uppercase truncate">
                          {settings.schoolName}
                        </h4>
                      </div>
                    </div>
                    <div className="bg-amber-400/20 text-amber-300 text-[8px] tracking-widest font-bold py-0.5 rounded uppercase mt-1">
                      KARTU TANDA PELAJAR BIOMETRIK
                    </div>
                  </div>

                  {/* Card Body - Portrait Stack */}
                  <div className="p-4 bg-white flex-1 flex flex-col items-center justify-between text-center">
                    {/* Student Face Photo & Class Badge */}
                    <div className="flex flex-col items-center">
                      {student.facePhoto ? (
                        <div className="w-28 h-32 rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden bg-slate-100">
                          <img
                            src={student.facePhoto}
                            alt={`Foto ${student.name}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-28 h-32 rounded-xl bg-blue-600 flex flex-col items-center justify-center text-white border-2 border-slate-200 shadow-sm relative overflow-hidden">
                          <span className="text-3xl font-extrabold">
                            {student.name.substring(0, 2).toUpperCase()}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-blue-100 mt-1">
                            {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 inline-block text-[10px] font-bold text-slate-900 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200">
                        {student.studentClass}
                      </div>
                    </div>

                    {/* Student Full Name & NIS */}
                    <div className="w-full mt-2 space-y-0.5">
                      <h3 className="font-extrabold text-slate-900 text-sm tracking-tight leading-snug px-1">
                        {student.name}
                      </h3>
                      <div className="text-xs font-semibold text-slate-600 font-mono">
                        NIS: {student.nis} · NISN: {student.nisn || '-'}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate max-w-[260px] mx-auto">
                        Wali: {student.parentName}
                      </p>
                    </div>

                    {/* Biometric Face Verification Badge */}
                    <div className="my-2.5 w-full flex flex-col items-center">
                      <div
                        className={`w-full px-3 py-2.5 rounded-xl border flex items-center justify-center gap-2 ${
                          hasFace
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {hasFace ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <ScanFace className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <div className="text-left leading-tight">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider">
                            {hasFace ? 'Face ID Terverifikasi' : 'ID Presensi Wajah'}
                          </p>
                          <p className="text-[9px] opacity-80">
                            {hasFace
                              ? 'Biometrik 128-D Aktif'
                              : 'Siap Scan Foto Wajah'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono tracking-wider font-semibold text-slate-500 mt-1.5 uppercase">
                        PINDAI FOTO WAJAH UNTUK PRESENSI
                      </span>
                    </div>

                    {/* Card Footer: Signature Block & Validity */}
                    <div className="w-full pt-2 border-t border-slate-200 flex items-end justify-between text-[8px] text-slate-500">
                      <div className="text-left">
                        <p className="font-medium text-slate-600">Berlaku:</p>
                        <p className="text-slate-400">Selama Siswa Aktif</p>
                        <p className="font-mono text-[7px] text-slate-500 tracking-tight mt-0.5">
                          ID: SAS-{student.nis}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[8px] text-slate-600 font-medium">Kepala Sekolah,</p>
                        <div className="h-6" />
                        <p className="font-bold text-[9px] text-slate-900 underline">
                          {settings.principalName}
                        </p>
                        <p className="text-[7px] text-slate-500 font-mono">
                          NIP. {settings.principalNip}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Accent Strip */}
                  <div className="h-1.5 bg-gradient-to-r from-amber-400 via-blue-900 to-indigo-950" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Footer (No print) */}
        <div className="no-print px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan {displayList.length} kartu pelajar portrait siap cetak</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
