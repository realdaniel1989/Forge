import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { Habit, HabitLog } from '../types';
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
import { Plus, MoreVertical, Pencil, Archive } from 'lucide-react';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

function getCellColor(actual: number | undefined, target: number): string {
  if (actual == null) return 'var(--surface)';
  if (actual === 0) return 'var(--hairline-2)';
  if (actual >= target) return '#22c55e';
  if (actual >= target * 0.5) return '#f59e0b';
  return '#ef444466';
}

function computeStreaks(logs: HabitLog[], target: number): { current: number; longest: number; hitRate: number } {
  if (logs.length === 0) return { current: 0, longest: 0, hitRate: 0 };
  const byDate: Record<string, number> = {};
  logs.forEach(l => { byDate[l.date] = l.actual; });
  const hits = Object.values(byDate).filter(v => v >= target).length;
  const hitRate = Math.round((hits / Object.keys(byDate).length) * 100);
  let current = 0;
  let d = new Date();
  while (true) {
    const key = format(d, 'yyyy-MM-dd');
    if (byDate[key] != null && byDate[key] >= target) { current++; d = subDays(d, 1); } else { break; }
  }
  const sortedDates = Object.keys(byDate).sort();
  let longest = 0;
  let temp = 0;
  for (const dateStr of sortedDates) {
    if (byDate[dateStr] >= target) { temp++; longest = Math.max(longest, temp); } else { temp = 0; }
  }
  return { current, longest, hitRate };
}

const Heatmap: React.FC<{ logs: HabitLog[]; habit: Habit; dateRange: 'week' | '30days' | 'alltime' }> = ({ logs, habit, dateRange }) => {
  const byDate: Record<string, number> = {};
  logs.forEach(l => { byDate[l.date] = l.actual; });
  const today = new Date();
  const CELL = 13, GAP = 2, STEP = 15;

  if (dateRange === 'week') {
    const days = eachDayOfInterval({ start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });
    return (
      <svg width={days.length * STEP} height={CELL} viewBox={`0 0 ${days.length * STEP} ${CELL}`} style={{ display: 'block' }}>
        {days.map((d, i) => {
          const key = format(d, 'yyyy-MM-dd');
          return (
            <rect key={key} x={i * STEP} y={0} width={CELL} height={CELL} rx={2} fill={getCellColor(byDate[key], habit.target)}>
              <title>{format(d, 'MMM d')} — {byDate[key] != null ? `${byDate[key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
            </rect>
          );
        })}
      </svg>
    );
  }

  if (dateRange === '30days') {
    const days = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i));
    return (
      <div className="overflow-x-auto">
        <svg width={days.length * STEP} height={CELL} viewBox={`0 0 ${days.length * STEP} ${CELL}`} style={{ display: 'block' }}>
          {days.map((d, i) => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <rect key={key} x={i * STEP} y={0} width={CELL} height={CELL} rx={2} fill={getCellColor(byDate[key], habit.target)}>
                <title>{format(d, 'MMM d')} — {byDate[key] != null ? `${byDate[key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
              </rect>
            );
          })}
        </svg>
      </div>
    );
  }

  const COLS = 52, ROWS = 7;
  const startDate = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), COLS - 1);
  const cells: { x: number; y: number; key: string; d: Date }[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + col * 7 + row);
      if (d > today) continue;
      cells.push({ x: col * STEP, y: row * STEP, key: format(d, 'yyyy-MM-dd'), d });
    }
  }
  return (
    <div className="overflow-x-auto">
      <svg width={COLS * STEP} height={ROWS * STEP} viewBox={`0 0 ${COLS * STEP} ${ROWS * STEP}`} style={{ display: 'block' }}>
        {cells.map(c => (
          <rect key={c.key} x={c.x} y={c.y} width={CELL} height={CELL} rx={2} fill={getCellColor(byDate[c.key], habit.target)}>
            <title>{format(c.d, 'MMM d')} — {byDate[c.key] != null ? `${byDate[c.key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
};

export const HabitTracker: React.FC = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dateRange, setDateRange] = useState<'week' | '30days' | 'alltime'>('alltime');
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitForm, setHabitForm] = useState({ name: '', target: '', unit: '' });
  const [habitSaving, setHabitSaving] = useState(false);
  const [habitError, setHabitError] = useState('');
  const [loggingHabit, setLoggingHabit] = useState<Habit | null>(null);
  const [logValue, setLogValue] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [habitsSnap, logsSnap] = await Promise.all([
          getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'habitLogs'), where('userId', '==', user.uid))),
        ]);
        const fetchedHabits: Habit[] = [];
        habitsSnap.forEach(d => fetchedHabits.push({ id: d.id, ...d.data() } as Habit));
        const fetchedLogs: HabitLog[] = [];
        logsSnap.forEach(d => fetchedLogs.push({ id: d.id, ...d.data() } as HabitLog));
        setHabits(fetchedHabits.sort((a, b) => a.createdAt - b.createdAt));
        setHabitLogs(fetchedLogs);
      } catch(e) {
        handleFirestoreError(e, OperationType.LIST, 'habits');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.uid]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const getTodayLog = (habitId: string) => habitLogs.find(l => l.habitId === habitId && l.date === today);
  const getLogsForHabit = (habitId: string) => habitLogs.filter(l => l.habitId === habitId);

  const handleHabitSave = async () => {
    const name = habitForm.name.trim();
    const target = parseFloat(habitForm.target);
    const unit = habitForm.unit.trim();
    if (!name || isNaN(target) || target <= 0 || !unit) {
      setHabitError('All fields are required. Target must be a positive number.');
      return;
    }
    if (!user) return;
    setHabitSaving(true);
    try {
      if (editingHabit) {
        await updateDoc(doc(db, 'habits', editingHabit.id), { name, target, unit });
        setHabits(habits.map(h => h.id === editingHabit.id ? { ...h, name, target, unit } : h));
      } else {
        const docRef = await addDoc(collection(db, 'habits'), {
          userId: user.uid, name, target, unit, createdAt: Date.now(), archived: false
        });
        setHabits([...habits, { id: docRef.id, userId: user.uid, name, target, unit, createdAt: Date.now(), archived: false }]);
      }
      setShowHabitModal(false);
      setEditingHabit(null);
      setHabitForm({ name: '', target: '', unit: '' });
    } catch(e) {
      handleFirestoreError(e, editingHabit ? OperationType.UPDATE : OperationType.CREATE, 'habits');
      setHabitError('Failed to save. Try again.');
    } finally {
      setHabitSaving(false);
    }
  };

  const handleArchive = async (habit: Habit) => {
    try {
      await updateDoc(doc(db, 'habits', habit.id), { archived: !habit.archived });
      setHabits(habits.map(h => h.id === habit.id ? { ...h, archived: !h.archived } : h));
      setOpenMenuId(null);
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `habits/${habit.id}`);
    }
  };

  const handleLogSave = async () => {
    if (!loggingHabit || !user) return;
    const val = parseFloat(logValue);
    if (isNaN(val) || val < 0) { setLogError('Enter a valid number'); return; }
    setLogSaving(true);
    try {
      const existing = getTodayLog(loggingHabit.id);
      if (existing) {
        await updateDoc(doc(db, 'habitLogs', existing.id), { actual: val });
        setHabitLogs(habitLogs.map(l => l.id === existing.id ? { ...l, actual: val } : l));
      } else {
        const docRef = await addDoc(collection(db, 'habitLogs'), {
          userId: user.uid, habitId: loggingHabit.id, date: today, actual: val, createdAt: Date.now()
        });
        setHabitLogs([...habitLogs, { id: docRef.id, userId: user.uid, habitId: loggingHabit.id, date: today, actual: val, createdAt: Date.now() }]);
      }
      setLoggingHabit(null);
      setLogValue('');
      setLogError('');
    } catch(e) {
      handleFirestoreError(e, OperationType.WRITE, 'habitLogs');
      setLogError('Failed to save. Try again.');
    } finally {
      setLogSaving(false);
    }
  };

  const visibleHabits = habits.filter(h => showArchived ? true : !h.archived);

  if (loading) {
    return <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10" style={condensed}>Loading Habits…</p>;
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <h1 className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none" style={{ ...condensed, letterSpacing: '-0.02em' }}>Habits</h1>
        <button
          onClick={() => { setEditingHabit(null); setHabitForm({ name: '', target: '', unit: '' }); setHabitError(''); setShowHabitModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--action)] text-white rounded-lg text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity border-none shrink-0"
          style={condensed}
        >
          <Plus className="w-4 h-4" /> New Habit
        </button>
      </div>

      {/* Date range toggle */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg w-fit">
        {(['week', '30days', 'alltime'] as const).map(r => (
          <button key={r} onClick={() => setDateRange(r)}
            className={`px-4 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors border-none ${dateRange === r ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-sm' : 'bg-none text-[var(--stone)] hover:text-[var(--ash)]'}`}
            style={condensed}>
            {r === 'week' ? 'This Week' : r === '30days' ? 'Last 30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {visibleHabits.length === 0 && (
        <div className="border border-[var(--hairline)] rounded-lg px-6 py-12 text-center">
          <p className="text-[13px] text-[var(--stone)]" style={condensed}>No habits yet. Create one to start tracking.</p>
        </div>
      )}

      {/* Habit cards */}
      <div className="flex flex-col gap-4">
        {visibleHabits.map(habit => {
          const todayLog = getTodayLog(habit.id);
          const logs = getLogsForHabit(habit.id);
          const { current, longest, hitRate } = computeStreaks(logs, habit.target);
          return (
            <div key={habit.id} className={`border border-[var(--hairline)] rounded-lg overflow-hidden ${habit.archived ? 'opacity-50' : ''}`}>
              {/* Card header */}
              <div className="px-5 py-4 border-b border-[var(--hairline)] flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-black uppercase text-[var(--ink)] leading-tight" style={condensed}>{habit.name}</h3>
                  <p className="text-[11px] text-[var(--stone)] mt-0.5" style={condensed}>Target: {habit.target} {habit.unit} / day</p>
                  {todayLog ? (
                    <p className="text-[12px] font-semibold mt-1" style={{ ...condensed, color: todayLog.actual >= habit.target ? '#22c55e' : 'var(--action)' }}>
                      Today: {todayLog.actual} {habit.unit}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--stone)] mt-1" style={condensed}>Not logged today</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setLoggingHabit(habit); setLogValue(todayLog?.actual.toString() || ''); setLogError(''); }}
                    className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--hairline-2)] rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ash)] hover:border-[var(--ash)] cursor-pointer transition-colors"
                    style={condensed}
                  >
                    {todayLog ? 'Edit today' : 'Log today'}
                  </button>
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === habit.id ? null : habit.id)}
                      className="w-8 h-8 flex items-center justify-center text-[var(--stone)] hover:text-[var(--ash)] cursor-pointer bg-none border-none">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === habit.id && (
                      <div className="absolute right-0 top-9 z-20 bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg shadow-lg w-36 py-1">
                        <button
                          onClick={() => { setEditingHabit(habit); setHabitForm({ name: habit.name, target: habit.target.toString(), unit: habit.unit }); setHabitError(''); setShowHabitModal(true); setOpenMenuId(null); }}
                          className="w-full text-left px-4 py-2 text-[12px] text-[var(--ash)] hover:bg-[var(--surface-2)] cursor-pointer flex items-center gap-2 bg-none border-none"
                          style={condensed}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleArchive(habit)}
                          className="w-full text-left px-4 py-2 text-[12px] text-[var(--ash)] hover:bg-[var(--surface-2)] cursor-pointer flex items-center gap-2 bg-none border-none"
                          style={condensed}
                        >
                          {habit.archived ? (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.07"/></svg> Unarchive</>
                          ) : (
                            <><Archive className="w-3.5 h-3.5" /> Archive</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Heatmap */}
              <div className="px-5 py-4 border-b border-[var(--hairline)]">
                <Heatmap logs={logs} habit={habit} dateRange={dateRange} />
              </div>
              {/* Stats */}
              <div className="grid grid-cols-4">
                {[
                  { label: 'Days Logged', value: logs.length },
                  { label: 'Hit Rate', value: `${hitRate}%` },
                  { label: 'Streak', value: current },
                  { label: 'Best Streak', value: longest },
                ].map((stat, i) => (
                  <div key={stat.label} className={`px-4 py-3 ${i < 3 ? 'border-r border-[var(--hairline)]' : ''}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-0.5" style={condensed}>{stat.label}</p>
                    <p className="text-[16px] font-black text-[var(--action)]" style={condensed}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show archived toggle */}
      {habits.some(h => h.archived) && (
        <button onClick={() => setShowArchived(!showArchived)}
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)] hover:text-[var(--ash)] cursor-pointer bg-none border-none p-0"
          style={condensed}>
          {showArchived ? 'Hide archived' : `Show archived (${habits.filter(h => h.archived).length})`}
        </button>
      )}

      {/* Habit create/edit modal */}
      {showHabitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-xl w-full max-w-[400px] p-6 flex flex-col gap-5">
            <h2 className="text-[20px] font-black uppercase text-[var(--ink)]" style={condensed}>{editingHabit ? 'Edit Habit' : 'New Habit'}</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Name', key: 'name', placeholder: 'e.g. Intermittent Fasting', type: 'text' },
                { label: 'Daily Target', key: 'target', placeholder: 'e.g. 16', type: 'number' },
                { label: 'Unit', key: 'unit', placeholder: 'e.g. hours, liters, steps', type: 'text' },
              ].map(field => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)]" style={condensed}>{field.label}</label>
                  <input type={field.type} placeholder={field.placeholder}
                    value={habitForm[field.key as keyof typeof habitForm]}
                    onChange={e => setHabitForm({ ...habitForm, [field.key]: e.target.value })}
                    className="bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[var(--ink)] text-[14px] outline-none focus:border-[var(--action)] transition-colors" />
                </div>
              ))}
              {habitError && <p className="text-[11px] text-[var(--action)]">{habitError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowHabitModal(false); setEditingHabit(null); }}
                className="flex-1 py-2.5 rounded-lg border border-[var(--hairline)] text-[var(--stone)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
                style={condensed}>Cancel</button>
              <button onClick={handleHabitSave} disabled={habitSaving}
                className="flex-1 py-2.5 rounded-lg bg-[var(--action)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 border-none"
                style={condensed}>{habitSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Log today modal */}
      {loggingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-xl w-full max-w-[360px] p-6 flex flex-col gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>{format(new Date(), 'MMM dd, yyyy')}</p>
              <h2 className="text-[20px] font-black uppercase text-[var(--ink)]" style={condensed}>{loggingHabit.name}</h2>
              <p className="text-[11px] text-[var(--stone)] mt-0.5" style={condensed}>Target: {loggingHabit.target} {loggingHabit.unit}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)]" style={condensed}>Actual</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.1"
                  placeholder={`e.g. ${loggingHabit.target}`}
                  value={logValue}
                  onChange={e => { setLogValue(e.target.value); setLogError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogSave(); if (e.key === 'Escape') setLoggingHabit(null); }}
                  className="flex-1 bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[var(--ink)] text-[15px] font-mono outline-none focus:border-[var(--action)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus />
                <span className="text-[13px] font-semibold text-[var(--stone)]" style={condensed}>{loggingHabit.unit}</span>
              </div>
              {logError && <p className="text-[11px] text-[var(--action)]">{logError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLoggingHabit(null)}
                className="flex-1 py-2.5 rounded-lg border border-[var(--hairline)] text-[var(--stone)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
                style={condensed}>Cancel</button>
              <button onClick={handleLogSave} disabled={logSaving}
                className="flex-1 py-2.5 rounded-lg bg-[var(--action)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 border-none"
                style={condensed}>{logSaving ? 'Saving…' : 'Log'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Close kebab on outside click */}
      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
};
