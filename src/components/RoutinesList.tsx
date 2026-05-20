import React, { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { Routine } from '../types';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const RoutinesList: React.FC<{
  onStartWorkout: (r: Routine) => void;
  onCreateCustom: () => void;
  onGenerateAI: () => void;
  refreshKey?: number;
}> = ({ onStartWorkout, onCreateCustom, onGenerateAI, refreshKey = 0 }) => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchRoutines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'routines'), where('userId', '==', user.uid), limit(50));
      const snap = await getDocs(q);
      const fetched: Routine[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as Routine));
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setRoutines(fetched);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'routines');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines, refreshKey]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'routines', deleteTarget));
      setRoutines(prev => prev.filter(r => r.id !== deleteTarget));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `routines/${deleteTarget}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10"
         style={condensed}>Loading…</p>
    );
  }

  return (
    <div className="flex flex-col gap-0">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1"
             style={condensed}>
            {routines.length} routine{routines.length !== 1 ? 's' : ''} saved
          </p>
          <h1
            className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none"
            style={{ ...condensed, letterSpacing: '-0.02em' }}
          >
            My Routines
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGenerateAI}
            className="flex items-center gap-2 px-4 sm:px-5 py-[10px] rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
            style={condensed}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3c-1 3-3 5-5 6 2 1 4 3 5 6 1-3 3-5 5-6-2-1-4-3-5-6z"/>
            </svg>
            AI Generate
          </button>
          <button
            onClick={onCreateCustom}
            className="flex items-center gap-2 px-4 sm:px-5 py-[10px] rounded-full bg-[var(--ink)] text-[var(--canvas)] border-none text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-85 transition-opacity"
            style={condensed}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h3
            className="text-[22px] sm:text-[28px] font-black uppercase text-[var(--ink)] mb-3 leading-none"
            style={{ ...condensed, letterSpacing: '-0.01em' }}
          >
            No Routines Yet
          </h3>
          <p className="text-[14px] text-[var(--stone)] mb-8 max-w-[300px] leading-relaxed">
            Create your first routine manually or let the AI build one for your goals.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onGenerateAI}
              className="px-6 py-[11px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:bg-[var(--action-hover)] transition-colors"
              style={condensed}
            >
              Generate with AI
            </button>
            <button
              onClick={onCreateCustom}
              className="px-6 py-[11px] rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
              style={condensed}
            >
              Build Manually
            </button>
          </div>
        </div>
      ) : (
        /* ── ROUTINE ROWS ── */
        <div className="flex flex-col">
          {routines.map((routine, idx) => {
            const isLatest = idx === 0;
            const exerciseCount = routine.exercises.length;
            const totalSets = routine.exercises.reduce((acc, ex) => acc + (ex.sets || 0), 0);

            return (
              <div
                key={routine.id}
                className={`py-6 border-b border-[var(--hairline)] ${isLatest ? 'border-t border-t-[var(--hairline)]' : ''}`}
              >
                {/* Mobile: stacked layout */}
                <div className="sm:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {routine.bodyPart && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-[3px] rounded-full bg-[var(--pill-bg)] text-[var(--pill-text)]" style={condensed}>{routine.bodyPart}</span>
                        )}
                        {routine.isGenerated && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-[3px] rounded-full bg-[var(--pill-bg)] text-[var(--stone)]" style={condensed}>AI</span>
                        )}
                      </div>
                      <h2 className="text-[22px] font-bold uppercase text-[var(--ink)] leading-tight" style={{ ...condensed, letterSpacing: '-0.01em' }}>{routine.name}</h2>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(routine.id!); }} className="mt-1 text-[var(--stone)] hover:text-[var(--action)] transition-colors border-none bg-none cursor-pointer p-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                  {/* Exercise list */}
                  {routine.exercises.length > 0 && (
                    <ul className="flex flex-col gap-0.5 mt-2">
                      {routine.exercises.slice(0, 4).map((ex, i) => (
                        <li key={i} className="flex items-baseline gap-2 text-[13px] text-[var(--stone)]">
                          <span className="text-[var(--hairline-2)] shrink-0" style={condensed}>–</span>
                          <span className="truncate">
                            {ex.name}
                            {ex.type === 'cardio'
                              ? ex.duration ? <span className="text-[11px] text-[var(--stone)] ml-1" style={condensed}>{ex.duration}m</span> : null
                              : (ex.sets && ex.reps) ? <span className="text-[11px] text-[var(--stone)] ml-1" style={condensed}>{ex.sets}×{ex.reps}</span> : null
                            }
                          </span>
                        </li>
                      ))}
                      {routine.exercises.length > 4 && (
                        <li className="text-[11px] text-[var(--stone)]" style={condensed}>+{routine.exercises.length - 4} more</li>
                      )}
                    </ul>
                  )}
                  {/* Stats + Start */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[20px] font-bold text-[var(--charcoal)]" style={{ ...condensed, letterSpacing: '-0.02em' }}>{exerciseCount}</span>
                        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--stone)] ml-1" style={condensed}>ex</span>
                      </div>
                      {totalSets > 0 && (
                        <div>
                          <span className="text-[20px] font-bold text-[var(--charcoal)]" style={{ ...condensed, letterSpacing: '-0.02em' }}>{totalSets}</span>
                          <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--stone)] ml-1" style={condensed}>sets</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => onStartWorkout(routine)} className="px-6 py-[10px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:bg-[var(--action-hover)] transition-colors" style={condensed}>Start</button>
                  </div>
                </div>

                {/* Desktop: side-by-side layout */}
                <div className="hidden sm:flex items-start gap-6">

                  {/* Left: latest indicator */}
                  <div className={`w-[3px] self-stretch shrink-0 rounded-full mt-1 ${isLatest ? 'bg-[var(--ink)]' : 'bg-transparent'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {routine.bodyPart && (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-3 py-[3px] rounded-full bg-[var(--pill-bg)] text-[var(--pill-text)]" style={condensed}>{routine.bodyPart}</span>
                      )}
                      {routine.isGenerated && (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-3 py-[3px] rounded-full bg-[var(--pill-bg)] text-[var(--stone)]" style={condensed}>AI Generated</span>
                      )}
                      {isLatest && (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-3 py-[3px] rounded-full bg-[var(--pill-bg)] text-[var(--stone)]" style={condensed}>Most Recent</span>
                      )}
                    </div>
                    <h2 className="text-[28px] font-bold uppercase text-[var(--ink)] leading-none mb-2" style={{ ...condensed, letterSpacing: '-0.01em' }}>{routine.name}</h2>
                    {routine.exercises.length > 0 && (
                      <ul className="flex flex-col gap-0.5 mt-1">
                        {routine.exercises.slice(0, 6).map((ex, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-[13px] text-[var(--stone)]">
                            <span className="text-[var(--hairline-2)] shrink-0" style={condensed}>–</span>
                            <span>{ex.name}{ex.type === 'cardio' ? ex.duration ? <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>{ex.duration} min</span> : null : (ex.sets && ex.reps) ? <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>{ex.sets}×{ex.reps}</span> : null}</span>
                          </li>
                        ))}
                        {routine.exercises.length > 6 && (
                          <li className="text-[11px] text-[var(--stone)] pl-4" style={condensed}>+{routine.exercises.length - 6} more</li>
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Right: stats + actions */}
                  <div className="flex flex-col items-end gap-4 shrink-0">
                    <div className="flex items-start gap-5 text-right">
                      <div>
                        <div className="text-[28px] font-bold text-[var(--charcoal)] leading-none" style={{ ...condensed, letterSpacing: '-0.02em' }}>{exerciseCount}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mt-0.5" style={condensed}>Exercises</div>
                      </div>
                      {totalSets > 0 && (
                        <div>
                          <div className="text-[28px] font-bold text-[var(--charcoal)] leading-none" style={{ ...condensed, letterSpacing: '-0.02em' }}>{totalSets}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mt-0.5" style={condensed}>Sets</div>
                        </div>
                      )}
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(routine.id!); }} className="mt-1 text-[var(--stone)] hover:text-[var(--action)] transition-colors border-none bg-none cursor-pointer p-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                    <button onClick={() => onStartWorkout(routine)} className="px-6 py-[10px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:bg-[var(--action-hover)] transition-colors" style={condensed}>Start</button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DELETE CONFIRMATION ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h3
                className="text-[22px] font-black uppercase text-[var(--ink)] mb-2"
                style={{ ...condensed, letterSpacing: '-0.01em' }}
              >
                Delete Routine?
              </h3>
              <p className="text-[13px] text-[var(--stone)] leading-relaxed">
                This routine will be permanently removed. You cannot undo this.
              </p>
            </div>
            <div className="flex border-t border-[var(--hairline)]">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ash)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors bg-none border-none cursor-pointer"
                style={condensed}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--action)] hover:bg-[var(--surface)] border-l border-[var(--hairline)] transition-colors bg-none cursor-pointer"
                style={condensed}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
