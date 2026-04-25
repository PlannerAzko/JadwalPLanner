/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Calendar as CalendarIcon, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Clock,
  Briefcase,
  User as UserIcon,
  Search,
  LayoutGrid
} from 'lucide-react';
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Configuration
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1V-EpPGFSlV7rgMRx0jIwqS7-MCKTMgi7K3AyV9PcBI0/export?format=csv&gid=85958515';

interface ShiftInfo {
  code: string;
  time: string;
  label: string;
  color: string;
  textColor: string;
}

const SHIFT_LEGEND: Record<string, ShiftInfo> = {
  'M0025': { code: 'M0025', time: '08:00 - 15:40', label: 'Morning Shift', color: 'bg-blue-50 border-blue-100 border-l-blue-500', textColor: 'text-blue-800' },
  'M0010': { code: 'M0010', time: '07:00 - 15:00', label: 'Morning Shift', color: 'bg-blue-50 border-blue-100 border-l-blue-500', textColor: 'text-blue-800' },
  'M0026': { code: 'M0026', time: '08:00 - 16:00', label: 'Morning Shift', color: 'bg-blue-50 border-blue-100 border-l-blue-500', textColor: 'text-blue-800' },
  'M0067': { code: 'M0067', time: '10:00 - 18:00', label: 'Mid Shift', color: 'bg-orange-50 border-orange-100 border-l-orange-500', textColor: 'text-orange-900' },
  'A0005': { code: 'A0005', time: '13:00 - 20:40', label: 'Afternoon Shift', color: 'bg-emerald-50 border-emerald-100 border-l-emerald-500', textColor: 'text-emerald-900' },
  'A0018': { code: 'A0018', time: '15:00 - 23:00', label: 'Afternoon Shift', color: 'bg-emerald-50 border-emerald-100 border-l-emerald-500', textColor: 'text-emerald-900' },
  'A0022': { code: 'A0022', time: '16:00 - 23:40', label: 'Evening Shift', color: 'bg-purple-50 border-purple-100 border-l-purple-500', textColor: 'text-purple-900' },
  'OFF': { code: 'OFF', time: 'HOLIDAY', label: 'Libur', color: 'bg-slate-50 border-slate-200 border-l-slate-400', textColor: 'text-slate-500' },
  'AL': { code: 'AL', time: 'LEAVE', label: 'Cuti', color: 'bg-red-50 border-red-100 border-l-red-500', textColor: 'text-red-900' },
};

const DEFAULT_SHIFT: ShiftInfo = { code: '-', time: '', label: 'Unspecified', color: 'bg-white border-slate-100', textColor: 'text-slate-300' };

interface EmployeeSchedule {
  nik: string;
  name: string;
  jobTitle: string;
  bu: string;
  shifts: Record<string, string>; // date (YYYY-MM-DD) -> shift code
}

export default function App() {
  const [data, setData] = useState<EmployeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const monthDate = useMemo(() => new Date(2026, 3, 1), []); // April 2026

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(SPREADSHEET_URL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          complete: (results) => {
            const rows = results.data as string[][];
            
            // Header row is at index 3 (0-indexed)
            const headerRow = rows[3];
            if (!headerRow) throw new Error('Invalid spreadsheet format: Header not found');

            // Find column indices for dates
            const dateColumns: { index: number; dateStr: string }[] = [];
            headerRow.forEach((cell, idx) => {
              if (cell && cell.includes('-')) {
                const parts = cell.split('-');
                if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                  let year = 2026;
                  let month = 3; // April
                  let day = parseInt(parts[1]);
                  
                  if (day > 25 && idx < 20) {
                    month = 2; // March
                  }
                  
                  const dateObj = new Date(year, month, day);
                  dateColumns.push({ 
                    index: idx, 
                    dateStr: format(dateObj, 'yyyy-MM-dd') 
                  });
                }
              }
            });

            const employees: EmployeeSchedule[] = [];
            for (let i = 5; i < rows.length; i++) {
              const row = rows[i];
              if (row[1] && row[2] && row[1] !== 'NO' && !isNaN(parseInt(row[1]))) {
                const shifts: Record<string, string> = {};
                dateColumns.forEach(col => {
                  shifts[col.dateStr] = row[col.index] || 'OFF';
                });

                employees.push({
                  nik: row[2],
                  name: row[3],
                  jobTitle: row[4],
                  bu: row[5],
                  shifts
                });
              }
              if (row.includes('Keterangan')) break;
            }

            setData(employees);
            setLoading(false);
          },
          error: (err: any) => {
            setError(err.message);
            setLoading(false);
          }
        });
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(emp => 
      emp.name.toLowerCase().includes(search.toLowerCase()) || 
      emp.nik.includes(search)
    );
  }, [data, search]);

  const monthDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate)
    });
  }, [monthDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="font-sans font-medium text-slate-500 animate-pulse">Memuat Jadwal...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-red-100 shadow-xl shadow-red-500/5 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Info size={32} />
          </div>
          <h2 className="text-2xl font-sans font-bold text-slate-900 mb-2">Gagal memuat data</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Header - Professional Polish Style */}
      <header className="header-gradient text-white p-4 flex flex-col md:flex-row justify-between items-center shadow-lg z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white text-slate-900 font-black p-2 rounded shadow-sm text-sm">KLC</div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Sistem Informasi Jadwal Kegiatan</h1>
            <p className="text-xs text-slate-400">Periode: April 2026 • Unit: Order Planning</p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center mt-4 md:mt-0">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
            <Search size={14} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari NIK/Nama..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-xs focus:ring-0 w-32 placeholder:text-slate-500"
            />
          </div>
          <div className="h-6 w-px bg-white/20 hidden md:block"></div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">User Kawan Lama</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{data[0]?.bu || 'ID: 405928'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-slate-300 font-bold overflow-hidden shadow-inner">
             <UserIcon size={20} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar - Design HTML Pattern */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
          <section>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Aksi & Navigasi</h3>
            <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
              <button 
                onClick={() => setView('grid')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all text-xs font-bold",
                  view === 'grid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <LayoutGrid size={14} /> Grid
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all text-xs font-bold",
                  view === 'calendar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <CalendarIcon size={14} /> Kalender
              </button>
            </div>

            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Statistik Kehadiran</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Personil', val: data.length, icon: Users, color: 'bg-blue-500' },
                { label: 'Aktif Hari Ini', val: data.filter(e => e.shifts[format(new Date(2026, 3, 20), 'yyyy-MM-dd')] !== 'OFF').length, icon: Clock, color: 'bg-emerald-500' },
                { label: 'Cuti/AL', val: data.filter(e => e.shifts[format(new Date(2026, 3, 20), 'yyyy-MM-dd')] === 'AL').length, icon: Info, color: 'bg-red-500' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={cn("w-2 h-2 rounded-full", stat.color)}></span> {stat.label}
                  </span>
                  <span className="font-black text-slate-900">{stat.val}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-auto">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                <Info size={12} /> Info Shift
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
                {Object.values(SHIFT_LEGEND).map(s => (
                  <div key={s.code} className="flex items-center gap-2 text-[9px]">
                    <span className={cn("w-2 h-2 rounded-sm border-l-2", s.color)}></span>
                    <span className="font-bold text-slate-700">{s.code}</span>
                    <span className="text-slate-400 truncate">{s.time === 'HOLIDAY' ? 'Libur' : s.time}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] text-blue-800 font-bold mb-1">Rangkuman April 2026</p>
              <p className="text-[9px] text-blue-600 leading-relaxed">Seluruh jadwal operasional telah didaftarkan dan sesuai dengan kapasitas unit.</p>
            </div>
          </section>
        </aside>

        {/* Content Area */}
        <section className="flex-1 flex flex-col overflow-hidden bg-white">
          <AnimatePresence mode="wait">
            {view === 'grid' ? (
              <motion.div 
                key="grid-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto bg-slate-100"
              >
                <div className="min-w-max p-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="sticky left-0 z-20 bg-slate-50 p-3 border-b border-r border-slate-200 text-left min-w-[200px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Informasi Karyawan</span>
                          </th>
                          {monthDays.map((day) => {
                            const dayName = format(day, 'eee');
                            const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                            return (
                              <th key={day.toISOString()} className={cn(
                                "p-2 border-b border-r border-slate-200 text-center min-w-[45px]",
                                isWeekend ? "bg-slate-100" : "bg-slate-50"
                              )}>
                                <div className="text-[9px] uppercase font-bold text-slate-400">{dayName}</div>
                                <div className="text-xs font-bold">{format(day, 'dd')}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {filteredData.map((emp) => (
                          <tr key={emp.nik} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-3 border-r border-slate-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                              <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{emp.name}</div>
                              <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px] text-slate-400">
                                <span className="bg-slate-100 px-1 rounded">{emp.nik}</span>
                                <span className="truncate max-w-[100px]">{emp.bu}</span>
                              </div>
                            </td>
                            {monthDays.map((day) => {
                              const dateKey = format(day, 'yyyy-MM-dd');
                              const code = emp.shifts[dateKey] || 'OFF';
                              const shift = SHIFT_LEGEND[code] || DEFAULT_SHIFT;
                              const isToday = isSameDay(day, new Date(2026, 3, 20));

                              return (
                                <td key={dateKey} className={cn(
                                  "p-1 border-r border-slate-100 text-center",
                                  isToday && "bg-blue-50/50"
                                )}>
                                  <div 
                                    className={cn(
                                      "w-8 h-8 mx-auto flex items-center justify-center rounded text-[9px] font-black border-l-2 transition-all hover:scale-110",
                                      shift.color,
                                      shift.textColor
                                    )}
                                  >
                                    {code}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="calendar-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100 p-4 gap-4"
              >
                {/* Employee Selection List */}
                <div className="w-full md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pilih Karyawan</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {filteredData.map(emp => (
                      <button
                        key={emp.nik}
                        onClick={() => setSelectedEmployee(emp.nik)}
                        className={cn(
                          "w-full p-2.5 rounded-lg text-left transition-all mb-1",
                          selectedEmployee === emp.nik 
                            ? "bg-slate-900 text-white shadow-md" 
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="text-xs font-bold truncate">{emp.name}</div>
                        <div className={cn("text-[9px] font-mono", selectedEmployee === emp.nik ? "text-slate-400" : "text-slate-400")}>{emp.nik}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calendar View Area */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  {selectedEmployee ? (
                    <div className="flex-1 flex flex-col">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                          <h2 className="text-sm font-black text-slate-900">
                            {data.find(e => e.nik === selectedEmployee)?.name}
                          </h2>
                          <p className="text-[10px] text-slate-500 font-medium">Kalender Personal • April 2026</p>
                        </div>
                        <div className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded">
                           {data.find(e => e.nik === selectedEmployee)?.jobTitle}
                        </div>
                      </div>

                      <div className="grid grid-cols-7 border-b border-slate-200">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                          <div key={day} className="py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center bg-slate-50/50">
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 grid grid-cols-7 grid-rows-6 auto-rows-fr">
                        {/* Empty cells for start of month */}
                        {Array.from({ length: getDay(startOfMonth(monthDate)) }).map((_, i) => (
                          <div key={`empty-${i}`} className="border-r border-b border-slate-100 bg-slate-50/50"></div>
                        ))}

                        {monthDays.map(day => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const emp = data.find(e => e.nik === selectedEmployee)!;
                          const code = emp.shifts[dateKey] || 'OFF';
                          const shift = SHIFT_LEGEND[code] || DEFAULT_SHIFT;
                          
                          return (
                            <div 
                              key={dateKey}
                              className={cn(
                                "p-2 border-r border-b border-slate-100 flex flex-col gap-1 transition-all",
                                isSameDay(day, new Date(2026, 3, 20)) && "bg-blue-50/20"
                              )}
                            >
                              <span className="text-[10px] font-black text-slate-400">
                                {format(day, 'd')}
                              </span>
                              <div className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-black border-l-2 shadow-sm truncate",
                                shift.color,
                                shift.textColor
                              )}>
                                {code}
                              </div>
                              <div className="text-[8px] font-medium text-slate-400 leading-none truncate px-1">
                                {shift.time === 'HOLIDAY' ? '' : shift.time}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                        <CalendarIcon size={32} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-400 mb-2">Pilih karyawan untuk melihat kalender</h3>
                      <p className="text-[10px] text-slate-300 max-w-[200px]">Silakan klik salah satu nama di samping untuk melihat rincian jadwal personal.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer - Design HTML Pattern */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2 text-[10px] text-slate-500 flex justify-between">
        <span className="flex items-center gap-1"><Clock size={10} /> Terakhir diperbarui: {format(new Date(), 'dd MMM yyyy HH:mm', { locale: id })} WIB</span>
        <span className="font-medium">Kawan Lama Group &copy; 2026 • Enterprise Schedule Management</span>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
