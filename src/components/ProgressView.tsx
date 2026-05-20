import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { WorkoutLog } from '../types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { X, Trash2, Pencil } from 'lucide-react';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dateRange, setDateRange] = useState<'week' | '30days' | 'alltime'>('week');
  const [editingCalorieId, setEditingCalorieId] = useState<string | null>(null);
  const [calorieEditValue, setCalorieEditValue] = useState('');
  const [calorieSaving, setCalorieSaving] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'workoutLogs'), where('userId', '==', user.uid), limit(100));
        const snap = await getDocs(q);
        const fetched: WorkoutLog[] = [];
        snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as WorkoutLog));
        fetched.sort((a, b) => a.date - b.date);
        setLogs(fetched);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'workoutLogs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user?.uid]);

  const handleDeleteWorkout = async (logId: string) => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'workoutLogs', logId));
      setLogs(logs.filter(l => l.id !== logId));
      setSelectedWorkout(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `workoutLogs/${logId}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10" style={condensed}>Loading Analytics…</p>;
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const processDayLogs = (day: Date) => {
    const dayLogs = logs.filter(log => isSameDay(new Date(log.date), day));
    return { dayLogs };
  };

  // Compute weekly summary separately (not as a render side effect)
  const weeklySummary: Record<string, number> = {};
  daysInWeek.forEach(day => {
    const dayLogs = logs.filter(log => isSameDay(new Date(log.date), day));
    dayLogs.forEach(log => {
      let sets = 0, cardioMins = 0;
      log.exercises.forEach(ex => {
        if (ex.type === 'cardio') {
          if (ex.completed || (!Object.prototype.hasOwnProperty.call(ex, 'completed') && ex.duration)) {
            cardioMins += ex.duration || 0;
          }
        } else {
          if (ex.trackedSets?.length) {
            sets += ex.trackedSets.filter(s => s.completed).length;
          } else {
            sets += ex.actualSets || 0;
          }
        }
      });
      const part = log.bodyPart ? log.bodyPart.toUpperCase() : 'MIXED';
      if (sets > 0) { weeklySummary[part] = (weeklySummary[part] || 0) + sets; }
      if (cardioMins > 0) { weeklySummary['CARDIO (MIN)'] = (weeklySummary['CARDIO (MIN)'] || 0) + cardioMins; }
    });
  });

  // Calorie chart helpers
  const now = Date.now();
  const msPerDay = 86_400_000;
  const calorieLogs = (() => {
    if (dateRange === 'week') {
      return logs.filter(l => l.calories != null && l.date >= weekStart.getTime() && l.date <= weekEnd.getTime());
    }
    if (dateRange === '30days') {
      return logs.filter(l => l.calories != null && l.date >= now - 30 * msPerDay);
    }
    return logs.filter(l => l.calories != null);
  })();

  const totalCalories = calorieLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const avgCalories = calorieLogs.length > 0 ? Math.round(totalCalories / calorieLogs.length) : 0;
  const maxCalories = calorieLogs.length > 0 ? Math.max(...calorieLogs.map(l => l.calories || 0)) : 0;

  const barDays: { label: string; date: Date; calories: number }[] = (() => {
    const days: { label: string; date: Date; calories: number }[] = [];
    const count = dateRange === 'week' ? 7 : dateRange === '30days' ? 30 : Math.min(90, Math.ceil((now - (logs[0]?.date || now)) / msPerDay) + 1);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now - i * msPerDay);
      const dayLogs = logs.filter(l => l.calories != null && isSameDay(new Date(l.date), d));
      const cal = dayLogs.reduce((s, l) => s + (l.calories || 0), 0);
      days.push({ label: format(d, dateRange === 'week' ? 'EEE' : 'd'), date: d, calories: cal });
    }
    return days;
  })();

  const handleCalorieEdit = async (logId: string) => {
    const val = parseInt(calorieEditValue, 10);
    if (isNaN(val) || val < 0) {
      setEditingCalorieId(null);
      return;
    }
    setCalorieSaving(true);
    try {
      await updateDoc(doc(db, 'workoutLogs', logId), { calories: val });
      setLogs(logs.map(l => l.id === logId ? { ...l, calories: val } : l));
      setEditingCalorieId(null);
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `workoutLogs/${logId}`);
    } finally {
      setCalorieSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">

      {/* ── HEADER ── */}
      <div className="flex items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>
            Week of {format(weekStart, 'MMM dd')} – {format(weekEnd, 'MMM dd')}
          </p>
          <h1 className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none" style={{ ...condensed, letterSpacing: '-0.02em' }}>
            Analytics
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-full border border-[var(--hairline-2)] text-[var(--stone)] hover:text-[var(--ash)] hover:border-[var(--ash)] transition-colors bg-none cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-full border border-[var(--hairline-2)] text-[var(--stone)] hover:text-[var(--ash)] hover:border-[var(--ash)] transition-colors bg-none cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── DATE RANGE TOGGLE ── */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg w-fit">
        {(['week', '30days', 'alltime'] as const).map(r => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-4 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors border-none
              ${dateRange === r ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-sm' : 'bg-none text-[var(--stone)] hover:text-[var(--ash)]'}`}
            style={condensed}
          >
            {r === 'week' ? 'This Week' : r === '30days' ? 'Last 30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* ── CALORIE BAR CHART ── */}
      <div className="border border-[var(--hairline)] rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-[var(--hairline)] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Calories Burnt</span>
          {calorieLogs.length === 0 && (
            <span className="text-[11px] text-[var(--stone)]" style={condensed}>No calorie data in range</span>
          )}
        </div>
        {calorieLogs.length > 0 && (
          <>
            <div className="px-5 pt-4 pb-2 overflow-x-auto">
              <svg
                width={Math.max(barDays.length * 20, 300)}
                height={100}
                viewBox={`0 0 ${Math.max(barDays.length * 20, 300)} 100`}
                style={{ display: 'block', minWidth: '100%' }}
              >
                {barDays.map((d, i) => {
                  const barH = maxCalories > 0 ? Math.round((d.calories / maxCalories) * 72) : 0;
                  const x = i * (Math.max(barDays.length * 20, 300) / barDays.length);
                  const barW = Math.max((Math.max(barDays.length * 20, 300) / barDays.length) - 4, 4);
                  return (
                    <g key={d.label + i}>
                      {d.calories > 0 ? (
                        <rect x={x + 2} y={80 - barH} width={barW} height={barH} rx={2} fill="var(--action)" opacity={0.85} />
                      ) : (
                        <rect x={x + 2} y={8} width={barW} height={72} rx={2} fill="none" stroke="var(--hairline-2)" strokeDasharray="3 2" />
                      )}
                      <text x={x + barW / 2 + 2} y={96} textAnchor="middle" fontSize={8} fill="var(--stone)" fontFamily="'Barlow Condensed', sans-serif">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="grid grid-cols-3 border-t border-[var(--hairline)]">
              {[
                { label: 'Total', value: `${totalCalories.toLocaleString()} kcal` },
                { label: 'Avg / Session', value: `${avgCalories.toLocaleString()} kcal` },
                { label: 'Best Session', value: `${maxCalories.toLocaleString()} kcal` },
              ].map((stat, i) => (
                <div key={stat.label} className={`px-5 py-3 ${i < 2 ? 'border-r border-[var(--hairline)]' : ''}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-0.5" style={condensed}>{stat.label}</p>
                  <p className="text-[16px] font-black text-[var(--action)]" style={condensed}>{stat.value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── CALENDAR GRID (desktop) ── */}
      <div className="hidden sm:block border border-[var(--hairline)] rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-7">
          {daysInWeek.map((day, i) => {
            const { dayLogs } = processDayLogs(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={`px-4 py-4 min-h-[200px] flex flex-col ${isToday ? 'bg-[var(--surface)]' : ''} ${i < 6 ? 'border-r border-[var(--hairline)]' : ''}`}
              >
                {/* Day header */}
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1"
                  style={condensed}
                >
                  {format(day, 'EEE')}
                </p>
                <p
                  className={`leading-none mb-4 font-black ${isToday ? 'text-[var(--action)]' : 'text-[var(--ink)]'}`}
                  style={{ ...condensed, fontSize: '28px', letterSpacing: '-0.02em' }}
                >
                  {format(day, 'd')}
                </p>

                {/* Workout entries */}
                <div className="flex-1 flex flex-col gap-2">
                  {dayLogs.length > 0 ? (
                    dayLogs.map(log => {
                      let sets = 0, mins = 0;
                      log.exercises.forEach(ex => {
                        if (ex.type === 'cardio') {
                          if (ex.completed || (!Object.prototype.hasOwnProperty.call(ex, 'completed') && ex.duration)) mins += ex.duration || 0;
                        } else {
                          if (ex.trackedSets?.length) sets += ex.trackedSets.filter(s => s.completed).length;
                          else sets += ex.actualSets || 0;
                        }
                      });
                      const part = log.bodyPart ? log.bodyPart.toUpperCase() : (mins > 0 && sets === 0 ? 'CARDIO' : 'MIXED');
                      return (
                        <button
                          key={log.id}
                          onClick={() => setSelectedWorkout(log)}
                          className="w-full text-left bg-[var(--surface-2)] border border-[var(--hairline-2)] rounded-md px-3 py-2.5 cursor-pointer hover:border-[var(--ash)] transition-colors"
                        >
                          <p className="text-[12px] font-bold uppercase text-[var(--ink)] mb-0.5" style={condensed}>{part}</p>
                          {sets > 0 && <p className="text-[11px] text-[var(--action)] font-semibold" style={condensed}>{sets} sets</p>}
                          {mins > 0 && <p className="text-[11px] text-[var(--action)] font-semibold" style={condensed}>{mins} min</p>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-end justify-center pb-2">
                      <p className="text-[10px] font-semibold text-[var(--stone)] uppercase tracking-[0.08em]" style={condensed}>Rest</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CALENDAR LIST (mobile) ── */}
      <div className="sm:hidden border border-[var(--hairline)] rounded-lg overflow-hidden mb-6">
        {daysInWeek.map((day, i) => {
          const { dayLogs } = processDayLogs(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={`flex items-start gap-3 px-4 py-3 min-h-[56px] ${isToday ? 'bg-[var(--surface)]' : ''} ${i < 6 ? 'border-b border-[var(--hairline)]' : ''}`}
            >
              <div className="shrink-0 w-12 text-center pt-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)]" style={condensed}>{format(day, 'EEE')}</p>
                <p className={`text-[22px] font-black leading-none ${isToday ? 'text-[var(--action)]' : 'text-[var(--ink)]'}`} style={{ ...condensed, letterSpacing: '-0.02em' }}>{format(day, 'd')}</p>
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                {dayLogs.length > 0 ? dayLogs.map(log => {
                  let sets = 0, mins = 0;
                  log.exercises.forEach(ex => {
                    if (ex.type === 'cardio') { if (ex.completed || (!Object.prototype.hasOwnProperty.call(ex, 'completed') && ex.duration)) mins += ex.duration || 0; }
                    else { if (ex.trackedSets?.length) sets += ex.trackedSets.filter(s => s.completed).length; else sets += ex.actualSets || 0; }
                  });
                  const part = log.bodyPart ? log.bodyPart.toUpperCase() : (mins > 0 && sets === 0 ? 'CARDIO' : 'MIXED');
                  return (
                    <button key={log.id} onClick={() => setSelectedWorkout(log)} className="bg-[var(--surface-2)] border border-[var(--hairline-2)] rounded-md px-2.5 py-1.5 cursor-pointer hover:border-[var(--ash)] transition-colors text-left">
                      <span className="text-[11px] font-bold uppercase text-[var(--ink)]" style={condensed}>{part}</span>
                      {sets > 0 && <span className="text-[10px] text-[var(--action)] font-semibold ml-1" style={condensed}>{sets}s</span>}
                      {mins > 0 && <span className="text-[10px] text-[var(--action)] font-semibold ml-1" style={condensed}>{mins}m</span>}
                    </button>
                  );
                }) : (
                  <span className="text-[10px] font-semibold text-[var(--stone)] uppercase tracking-[0.08em]" style={condensed}>Rest</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── WEEKLY OUTPUT TABLE ── */}
      <div className="border border-[var(--hairline)] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--hairline)]">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Weekly Output</span>
        </div>
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[var(--hairline)]">
            <tr className="bg-[var(--surface)]">
              <th className="py-2.5 px-5 font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--stone)]" style={condensed}>Target Area</th>
              <th className="py-2.5 px-5 font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--stone)] text-right" style={condensed}>Volume</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(weeklySummary).length === 0 ? (
              <tr>
                <td colSpan={2} className="py-8 px-5 text-center text-[var(--stone)] text-[13px]">No activity recorded this week.</td>
              </tr>
            ) : (
              Object.entries(weeklySummary)
                .sort((a, b) => b[1] - a[1])
                .map(([part, val]) => (
                  <tr key={part} className="border-b border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors">
                    <td className="py-3 px-5 font-semibold uppercase text-[var(--ink)]" style={condensed}>{part}</td>
                    <td className="py-3 px-5 font-bold text-[var(--action)] text-right" style={condensed}>{val}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── WORKOUT DETAIL MODAL ── */}
      {selectedWorkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg w-full max-w-[600px] flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
            <div className="px-5 py-4 border-b border-[var(--hairline)] flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-[18px] font-bold uppercase text-[var(--ink)]" style={condensed}>{selectedWorkout.name}</h3>
                <p className="text-[11px] text-[var(--stone)] mt-0.5" style={condensed}>
                  {format(selectedWorkout.date, 'MMM dd, yyyy · h:mm a')}
                </p>
                {/* Calorie edit row */}
                <div className="flex items-center gap-2 mt-2">
                  {editingCalorieId === selectedWorkout.id ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        value={calorieEditValue}
                        onChange={e => setCalorieEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && selectedWorkout.id) handleCalorieEdit(selectedWorkout.id);
                          if (e.key === 'Escape') setEditingCalorieId(null);
                        }}
                        onBlur={() => selectedWorkout.id && handleCalorieEdit(selectedWorkout.id)}
                        className="w-24 bg-[var(--surface)] border border-[var(--action)] rounded px-2 py-1 text-[12px] font-mono text-[var(--ink)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                        disabled={calorieSaving}
                      />
                      <span className="text-[11px] text-[var(--stone)]" style={condensed}>kcal</span>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingCalorieId(selectedWorkout.id || null);
                        setCalorieEditValue(selectedWorkout.calories?.toString() || '');
                      }}
                      className="flex items-center gap-1.5 text-[11px] text-[var(--stone)] hover:text-[var(--ash)] transition-colors bg-none border-none cursor-pointer p-0"
                      style={condensed}
                    >
                      <Pencil className="w-3 h-3" />
                      {selectedWorkout.calories != null
                        ? `${selectedWorkout.calories} kcal`
                        : 'Add calories'}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => selectedWorkout.id && handleDeleteWorkout(selectedWorkout.id)}
                  disabled={deleting}
                  className="text-[var(--stone)] hover:text-[var(--action)] p-1.5 bg-none border-none cursor-pointer transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedWorkout(null)}
                  className="text-[var(--stone)] hover:text-[var(--ash)] p-1.5 bg-none border-none cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col gap-3">
              {selectedWorkout.exercises.map((ex, idx) => {
                const validSets = (ex.trackedSets ?? []).filter(s => s != null);
                const isTracked = validSets.length > 0;
                const hasLegacyLog = ex.actualSets != null && ex.actualSets > 0;
                const isCardio = ex.type === 'cardio' || (!ex.trackedSets && ex.duration != null && ex.sets == null);
                return (
                  <div key={`${ex.name}-${idx}`} className="border border-[var(--hairline)] rounded-lg overflow-hidden shrink-0">
                    <div className="px-4 py-2.5 border-b border-[var(--hairline)] bg-[var(--surface)] flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold uppercase text-[var(--ink)]" style={condensed}>
                        {String(idx + 1).padStart(2, '0')}. {ex.name}
                      </h4>
                      {isTracked && (
                        <span className="text-[11px] font-semibold text-[var(--stone)]" style={condensed}>
                          {validSets.filter(s => s.completed).length}/{validSets.length} sets
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {isCardio ? (
                        <div className="text-[13px] flex gap-6" style={condensed}>
                          <span className="text-[var(--stone)]">Duration: <strong className="text-[var(--action)]">{ex.duration || 0} min</strong></span>
                          <span className="text-[var(--stone)]">Distance: <strong className="text-[var(--action)]">{ex.distance || 0} {selectedWorkout.unit === 'lbs' ? 'mi' : 'km'}</strong></span>
                        </div>
                      ) : isTracked ? (
                        <div className="w-full text-[12px]" style={condensed}>
                          <div className="flex pb-2 text-[var(--stone)] font-semibold uppercase tracking-[0.06em]">
                            <span className="w-10">Set</span>
                            <span className="w-20">{(selectedWorkout.unit ?? 'lbs').toUpperCase()}</span>
                            <span className="flex-1">Reps</span>
                            <span className="text-right w-12">Status</span>
                          </div>
                          {validSets.map((set, si) => (
                            <div key={si} className="flex items-center py-2 border-t border-[var(--hairline)]">
                              <span className="w-10 text-[var(--ash)]">{String(si + 1).padStart(2, '0')}</span>
                              <span className="w-20 text-[var(--ink)] font-semibold">{set.weight ?? '—'}</span>
                              <span className="flex-1 text-[var(--ink)] font-semibold">{set.reps ?? '—'}</span>
                              <span className={`w-12 text-right ${set.completed ? 'text-[var(--action)] font-bold' : 'text-[var(--stone)]'}`}>
                                {set.completed ? 'Done' : 'Skip'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : hasLegacyLog ? (
                        <p className="text-[13px]" style={condensed}>
                          <span className="text-[var(--stone)]">Log: </span>
                          <span className="text-[var(--action)] font-bold">{ex.actualSets}×{ex.actualReps} @ {ex.actualWeight}{(selectedWorkout.unit ?? 'lbs').toUpperCase()}</span>
                        </p>
                      ) : (
                        <p className="text-[12px] text-[var(--stone)]" style={condensed}>No set data recorded</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
