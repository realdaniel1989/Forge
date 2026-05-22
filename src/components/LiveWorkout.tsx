import React, { useState, useEffect, useRef } from 'react';
import { Routine, Exercise, TrackedSet, WorkoutLog, BODY_PARTS } from '../types';
import { useAuth } from '../AuthContext';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { X, Loader2, Trash2, Plus, Timer, Search } from 'lucide-react';
import { playAlarm, prewarmAudio } from '../timerAlarm';
import { useWakeLock } from '../hooks/useWakeLock';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { NumericInput } from './NumericInput';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const GripHandle = ({ listeners, attributes }: { listeners: any; attributes: any }) => (
  <div
    {...listeners}
    {...attributes}
    className="flex flex-col gap-[3px] px-1.5 py-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
    title="Drag to reorder"
  >
    {[0, 1, 2].map(i => (
      <div key={i} className="w-3 h-[2px] rounded-full bg-[var(--border-2)]" />
    ))}
  </div>
);

type PreviousHistoryEntry = {name: string, sets: TrackedSet[], unit: string, bodyPart?: string, type?: 'strength' | 'cardio', duration?: number, distance?: number};

interface SortableCardProps {
  id: string;
  ex: Exercise;
  idx: number;
  isActive: boolean;
  unit: string;
  previousHistory: Record<string, PreviousHistoryEntry>;
  toDisplayUnit: (w: number) => number;
  fromDisplayUnit: (w: number) => number;
  updateSet: (ei: number, si: number, field: keyof TrackedSet, value: any) => void;
  updateExerciseName: (ei: number, name: string) => void;
  updateExerciseField: (ei: number, field: keyof Exercise, value: any) => void;
  addSet: (ei: number) => void;
  deleteSet: (ei: number, si: number) => void;
  deleteExercise: (ei: number) => void;
}

const SortableExerciseCard: React.FC<SortableCardProps> = ({
  id, ex, idx, isActive, unit, previousHistory,
  toDisplayUnit, fromDisplayUnit,
  updateSet, updateExerciseName, updateExerciseField,
  addSet, deleteSet, deleteExercise,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--bg-1)] border rounded-[var(--radius)] overflow-hidden ${isActive ? 'border-[var(--border-2)]' : 'border-[var(--border)]'}`}
    >
      <div className="px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <GripHandle listeners={listeners} attributes={attributes} />
          <span className={`font-mono text-[10px] font-bold shrink-0 ${isActive ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}>
            {String(idx + 1).padStart(2, '0')}
          </span>
          <input
            type="text"
            value={ex.name}
            onChange={(e) => updateExerciseName(idx, e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-semibold text-[var(--white)] min-w-0 w-full"
          />
          {ex.type === 'cardio' && (
            <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">{ex.duration} min</span>
          )}
          {ex.type !== 'cardio' && (
            <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">{ex.sets}×{ex.reps}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {ex.type !== 'cardio' && ex.trackedSets && (
            <div className="flex gap-[3px] items-center">
              {ex.trackedSets.map((set, si) => (
                <div key={si} className={`w-[7px] h-[7px] rounded-[2px] ${set.completed ? 'bg-[var(--red)]' : 'bg-[var(--bg-3)] border border-[var(--border-2)]'}`} />
              ))}
            </div>
          )}
          {ex.type === 'cardio' && (
            <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${ex.completed ? 'bg-[var(--red-dim)] text-[var(--red)]' : 'bg-[var(--bg-2)] text-[var(--muted)] border border-[var(--border)]'}`}>Cardio</span>
          )}
          <button onClick={() => deleteExercise(idx)} className="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        {ex.type === 'cardio' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4 py-2 font-mono text-[11px]">
              <div className="flex gap-4">
                <div>
                  <div className="text-[var(--muted)] mb-1 text-[9px] uppercase tracking-[0.1em]">Duration (min)</div>
                  <NumericInput integer min={0} value={ex.duration || 0} onChange={n => updateExerciseField(idx, 'duration', n)} className="bg-transparent border-b border-[var(--border-2)] w-16 outline-none focus:border-[var(--red)] text-[var(--white)] p-1 text-[13px] font-mono font-bold" />
                </div>
                <div>
                  <div className="text-[var(--muted)] mb-1 text-[9px] uppercase tracking-[0.1em]">Distance</div>
                  <NumericInput min={0} value={ex.distance || 0} onChange={n => updateExerciseField(idx, 'distance', n)} className="bg-transparent border-b border-[var(--border-2)] w-16 outline-none focus:border-[var(--red)] text-[var(--white)] p-1 text-[13px] font-mono font-bold" />
                </div>
              </div>
              <button
                onClick={() => updateExerciseField(idx, 'completed', !ex.completed)}
                className={`px-3 py-1 text-[10px] font-bold rounded-[var(--radius-sm)] uppercase tracking-[0.06em] transition-colors ${
                  ex.completed
                    ? 'bg-[var(--red)] text-white border-none'
                    : 'bg-transparent text-[var(--muted)] border border-[var(--border-2)] hover:text-[var(--text-2)] hover:border-[var(--muted)]'
                }`}
              >
                {ex.completed ? 'Done' : 'Pending'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="text-[var(--muted)]">
                <tr>
                  <th className="pb-3 px-2 font-normal uppercase text-[var(--muted)]">Set</th>
                  <th className="pb-3 px-2 font-normal uppercase text-[var(--muted)]">{unit}</th>
                  <th className="pb-3 px-2 font-normal uppercase text-[var(--muted)]">Reps</th>
                  <th className="pb-3 px-2 font-normal text-right text-[var(--muted)]">Status</th>
                  <th className="pb-3 px-2 font-normal w-8"></th>
                </tr>
              </thead>
              <tbody>
                {ex.trackedSets?.map((set, setIdx) => {
                  const history = previousHistory[ex.name.toLowerCase().trim()];
                  const prevSet = history?.sets[setIdx];
                  let ghostWeight = '';
                  if (prevSet) {
                    let w = prevSet.weight;
                    if (history.unit !== unit) {
                      if (history.unit === 'kgs' && unit === 'lbs') w = Math.round(w * 2.20462);
                      if (history.unit === 'lbs' && unit === 'kgs') w = Math.round(w / 2.20462);
                    }
                    ghostWeight = `${w}${unit} x ${prevSet.reps}`;
                  }
                  return (
                    <tr key={setIdx} className="border-b border-[var(--border)]/60 hover:bg-[var(--bg-2)]/30 transition-colors group">
                      <td className="py-2.5 px-2 text-[var(--text-2)] align-top">
                        <div className="pt-1">{String(setIdx + 1).padStart(2, '0')} / {ex.sets}</div>
                        {ghostWeight && (
                          <div className="text-[9px] text-[var(--border-2)] mt-1 whitespace-nowrap font-mono">prev: {ghostWeight}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 align-top">
                        <NumericInput
                          min={0}
                          value={parseFloat(toDisplayUnit(set.weight).toFixed(1))}
                          onChange={n => updateSet(idx, setIdx, 'weight', fromDisplayUnit(n))}
                          className="bg-transparent border-b border-[var(--border-2)] w-12 sm:w-16 outline-none focus:border-[var(--red)] text-[var(--white)] p-1 text-[13px] font-mono font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-2 align-top">
                        <NumericInput
                          integer
                          min={0}
                          value={set.reps}
                          onChange={n => updateSet(idx, setIdx, 'reps', n)}
                          className="bg-transparent border-b border-[var(--border-2)] w-12 sm:w-16 outline-none focus:border-[var(--red)] text-[var(--white)] p-1 text-[13px] font-mono font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right align-top">
                        <button
                          onClick={() => updateSet(idx, setIdx, 'completed', !set.completed)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-[var(--radius-sm)] uppercase tracking-[0.06em] transition-colors ${
                            set.completed
                              ? 'bg-[var(--red)] text-white border-none'
                              : 'bg-transparent text-[var(--muted)] border border-[var(--border-2)] hover:text-[var(--text-2)] hover:border-[var(--muted)]'
                          }`}
                        >
                          {set.completed ? 'Done' : 'Pending'}
                        </button>
                      </td>
                      <td className="py-2.5 px-2 text-right align-top">
                        <button
                          onClick={() => deleteSet(idx, setIdx)}
                          className="text-[var(--muted)] hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => addSet(idx)}
                className="bg-transparent text-[var(--muted)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Set
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const LiveWorkout: React.FC<{routine: Routine, onFinish: () => void}> = ({routine, onFinish}) => {
  const { user } = useAuth();
  const { addToLibrary } = useExerciseLibrary();
  const draftKey = `forge_workout_draft_${routine.id}`;
  const savedDraft: { exercises: Exercise[]; unit: 'lbs' | 'kgs'; baseUnit: 'lbs' | 'kgs' } | null = (() => {
    try {
      const raw = localStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [unit, setUnit] = useState<'lbs' | 'kgs'>(savedDraft?.unit || 'kgs');
  const CONVERSION_FACTOR = 2.20462;
  const baseUnitRef = useRef<'lbs' | 'kgs'>(savedDraft?.baseUnit || (savedDraft?.unit || 'kgs'));
  const timerEndTimeRef = useRef<number>(0);

  const toDisplayUnit = (weight: number): number => {
    if (baseUnitRef.current === unit) return weight;
    return unit === 'kgs' ? weight / CONVERSION_FACTOR : weight * CONVERSION_FACTOR;
  };

  const fromDisplayUnit = (weight: number): number => {
    if (baseUnitRef.current === unit) return weight;
    return unit === 'kgs' ? weight * CONVERSION_FACTOR : weight / CONVERSION_FACTOR;
  };

  const [exercises, setExercises] = useState<Exercise[]>(
    savedDraft?.exercises || routine.exercises.map(ex => ({
      ...ex,
      trackedSets: Array.from({ length: ex.sets }).map(() => ({
        reps: ex.reps,
        weight: ex.weight || 0,
        completed: false
      }))
    }))
  );
  const [saving, setSaving] = useState(false);
  const [previousHistory, setPreviousHistory] = useState<Record<string, {name: string, sets: TrackedSet[], unit: string, bodyPart?: string, type?: 'strength' | 'cardio', duration?: number, distance?: number}>>({});
  
  const [configuredRestTime, setConfiguredRestTime] = useState(90);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimerMinimized, setIsTimerMinimized] = useState(false);
  const { acquireWakeLock, releaseWakeLock } = useWakeLock();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalBodyPart, setAddModalBodyPart] = useState<string>('');
  const [filterByBodyPart, setFilterByBodyPart] = useState(!!routine.bodyPart);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [showCalorieModal, setShowCalorieModal] = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);
  const [calorieInput, setCalorieInput] = useState('');
  const [calorieSaving, setCalorieSaving] = useState(false);
  const [calorieError, setCalorieError] = useState('');

  // Find the active exercise index (first with an incomplete set)
  const activeExerciseIndex = exercises.findIndex(ex => {
    if (ex.type === 'cardio') return !ex.completed;
    return (ex.trackedSets || []).some(s => !s.completed);
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ exercises, unit, baseUnit: baseUnitRef.current }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [exercises, unit]);

  useEffect(() => {
    if (isTimerActive) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isTimerActive, acquireWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!isTimerActive) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEndTimeRef.current - Date.now()) / 1000));
      if (remaining === 0) {
        setIsTimerActive(false);
        setRestTimeRemaining(0);
        setIsTimerMinimized(false);
        playAlarm();
      } else {
        setRestTimeRemaining(remaining);
      }
    };

    const interval = setInterval(tick, 500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTimerActive, acquireWakeLock]);

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'workoutLogs'), where('userId', '==', user.uid), limit(10));
        const querySnapshot = await getDocs(q);
        const fetchedLogs: WorkoutLog[] = [];
        querySnapshot.forEach(doc => {
          fetchedLogs.push(doc.data() as WorkoutLog);
        });
        fetchedLogs.sort((a, b) => b.date - a.date);
        
        const hist: Record<string, {name: string, sets: TrackedSet[], unit: string, bodyPart?: string, type?: 'strength' | 'cardio', duration?: number, distance?: number}> = {};
        
        fetchedLogs.forEach(log => {
          log.exercises.forEach(ex => {
            const standardizedName = ex.name.toLowerCase().trim();
            if (!hist[standardizedName]) {
              if (ex.type === 'cardio') {
                hist[standardizedName] = { name: ex.name, sets: [], unit: log.unit || 'lbs', bodyPart: log.bodyPart, type: 'cardio', duration: ex.duration, distance: ex.distance };
              } else if (ex.trackedSets && ex.trackedSets.length > 0) {
                const completed = ex.trackedSets.filter(s => s.completed);
                if (completed.length > 0) {
                  hist[standardizedName] = { name: ex.name, sets: completed, unit: log.unit || 'lbs', bodyPart: log.bodyPart, type: 'strength' };
                }
              } else if (ex.actualSets && ex.actualReps != null && ex.actualWeight != null) {
                const mockSets: TrackedSet[] = [];
                for(let i=0; i<ex.actualSets; i++) {
                  mockSets.push({ reps: ex.actualReps, weight: ex.actualWeight, completed: true });
                }
                hist[standardizedName] = { name: ex.name, sets: mockSets, unit: log.unit || 'lbs', bodyPart: log.bodyPart, type: 'strength' };
              }
            }
          });
        });
        setPreviousHistory(hist);
      } catch (e) {
        console.error("Failed to fetch previous history", e);
      }
    };
    fetchLogs();
  }, [user]);

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof TrackedSet, value: any) => {
    const newEx = [...exercises];
    const newSets = [...(newEx[exerciseIndex].trackedSets || [])];
    const wasCompleted = newSets[setIndex].completed;
    newSets[setIndex] = { ...newSets[setIndex], [field]: value };
    newEx[exerciseIndex] = { ...newEx[exerciseIndex], trackedSets: newSets };
    setExercises(newEx);

    if (field === 'completed' && value === true && !wasCompleted) {
       prewarmAudio();
       timerEndTimeRef.current = Date.now() + configuredRestTime * 1000;
       setRestTimeRemaining(configuredRestTime);
       setIsTimerActive(true);
       setIsTimerMinimized(false);
    }
  };

  const updateExerciseName = (exerciseIndex: number, newName: string) => {
    const newEx = [...exercises];
    newEx[exerciseIndex] = { ...newEx[exerciseIndex], name: newName };
    setExercises(newEx);
  };

  const updateExerciseField = (exerciseIndex: number, field: keyof Exercise, value: any) => {
    const newEx = [...exercises];
    newEx[exerciseIndex] = { ...newEx[exerciseIndex], [field]: value };
    setExercises(newEx);
  };

  const addSet = (exerciseIndex: number) => {
    const newEx = [...exercises];
    const newSets = [...(newEx[exerciseIndex].trackedSets || [])];
    const lastSet = newSets[newSets.length - 1];
    
    newSets.push({
      reps: lastSet ? lastSet.reps : newEx[exerciseIndex].reps,
      weight: lastSet ? lastSet.weight : (newEx[exerciseIndex].weight || 0),
      completed: false
    });
    
    newEx[exerciseIndex] = { 
      ...newEx[exerciseIndex], 
      sets: newSets.length, 
      trackedSets: newSets 
    };
    setExercises(newEx);
  };

  const deleteSet = (exerciseIndex: number, setIndex: number) => {
    const newEx = [...exercises];
    const newSets = [...(newEx[exerciseIndex].trackedSets || [])];
    newSets.splice(setIndex, 1);
    
    newEx[exerciseIndex] = { 
      ...newEx[exerciseIndex], 
      sets: newSets.length, 
      trackedSets: newSets 
    };
    setExercises(newEx);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const exerciseIds = exercises.map((_, i) => String(i));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExercises(prev => arrayMove(prev, Number(active.id), Number(over.id)));
  };

  const deleteExercise = (index: number) => {
    const newEx = [...exercises];
    newEx.splice(index, 1);
    setExercises(newEx);
  };

  const addExercise = (name: string, fromHistory?: {sets: TrackedSet[], type?: 'strength' | 'cardio', duration?: number, distance?: number, unit?: string, bodyPart?: string}, explicitType?: 'strength' | 'cardio', bodyPart?: string) => {
    const isCardio = explicitType === 'cardio' || fromHistory?.type === 'cardio';
    const resolvedBodyPart = bodyPart || fromHistory?.bodyPart || (isCardio ? 'Cardio' : undefined);

    // Persist brand-new exercises (created via search, not selected from history) to the library
    if (!fromHistory && resolvedBodyPart) {
      addToLibrary(name, resolvedBodyPart as any, isCardio ? 'cardio' : 'strength').catch(() => {});
    }

    if (isCardio) {
      setExercises([...exercises, {
        name: name,
        type: 'cardio',
        duration: fromHistory?.duration || 30,
        distance: fromHistory?.distance || 0,
        completed: false,
        bodyPart: resolvedBodyPart
      }]);
    } else {
      const historyWeight = fromHistory ? (fromHistory.sets[0]?.weight || 0) : 0;
      const convertedWeight = fromHistory && fromHistory.unit && fromHistory.unit !== baseUnitRef.current
        ? (fromHistory.unit === 'kgs' ? historyWeight * CONVERSION_FACTOR : historyWeight / CONVERSION_FACTOR)
        : historyWeight;
      setExercises([...exercises, {
        name: name,
        type: 'strength',
        sets: fromHistory ? fromHistory.sets.length : 1,
        reps: fromHistory ? (fromHistory.sets[0]?.reps || 10) : 10,
        weight: convertedWeight,
        trackedSets: fromHistory && fromHistory.sets.length > 0 ? fromHistory.sets.map(s => ({...s, weight: 0, completed: false})) : [{ reps: 10, weight: 0, completed: false }],
        bodyPart: resolvedBodyPart
      }]);
    }
    setShowAddModal(false);
    setSearchQuery('');
    setAddModalBodyPart('');
  };

  const handleUnitChange = (newUnit: 'lbs' | 'kgs') => {
    if (newUnit === unit) return;
    setUnit(newUnit);
  };

  const finishWorkout = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const exercisesToSave = exercises.map(ex => ({
        ...ex,
        weight: ex.weight != null ? parseFloat(toDisplayUnit(ex.weight).toFixed(1)) : undefined,
        trackedSets: ex.trackedSets?.map(s => ({
          ...s,
          weight: parseFloat(toDisplayUnit(s.weight).toFixed(1)),
        })),
      }));
      const docRef = await addDoc(collection(db, 'workoutLogs'), {
        userId: user.uid,
        routineId: routine.id,
        name: routine.name,
        bodyPart: routine.bodyPart || null,
        date: Date.now(),
        unit: unit,
        exercises: exercisesToSave
      });
      localStorage.removeItem(draftKey);
      setSavedLogId(docRef.id);
      setCalorieInput('');
      setCalorieError('');
      setShowCalorieModal(true);
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, 'workoutLogs');
    } finally {
      setSaving(false);
    }
  };

  const handleCalorieSave = async () => {
    if (!savedLogId) return;
    const val = parseInt(calorieInput, 10);
    if (isNaN(val) || val < 0) {
      setCalorieError('Enter a valid number');
      return;
    }
    setCalorieSaving(true);
    try {
      await updateDoc(doc(db, 'workoutLogs', savedLogId), { calories: val });
      setShowCalorieModal(false);
      onFinish();
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `workoutLogs/${savedLogId}`);
      setCalorieError('Failed to save. Try again.');
    } finally {
      setCalorieSaving(false);
    }
  };

  const handleCalorieSkip = () => {
    setShowCalorieModal(false);
    onFinish();
  };

  const completedSets = exercises.reduce((acc, ex) => acc + (ex.trackedSets?.filter(s => s.completed).length || 0), 0);
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.type === 'cardio' ? 0 : (ex.trackedSets?.length || ex.sets || 0)), 0);

  const isTimerTakeover = restTimeRemaining > 0 && isTimerActive && !isTimerMinimized;
  const timerProgress = isTimerTakeover ? ((configuredRestTime - restTimeRemaining) / configuredRestTime) * 100 : 0;
  const isLowTime = restTimeRemaining <= 10 && restTimeRemaining > 0;

  // Find next set context for timer
  const getNextSetContext = () => {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      if (ex.type === 'cardio') continue;
      for (let j = 0; j < (ex.trackedSets?.length || 0); j++) {
        if (!ex.trackedSets![j].completed) {
          return {
            exerciseName: ex.name,
            setNum: j + 1,
            totalSets: ex.trackedSets?.length || 0,
            weight: parseFloat(toDisplayUnit(ex.trackedSets![j].weight).toFixed(1)),
            reps: ex.trackedSets![j].reps
          };
        }
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] -mx-4 -my-6 sm:-mx-8 sm:-my-10">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 bg-[var(--bg)] sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-2 bg-[var(--red)] rounded-full shrink-0" style={{ animation: 'pulse-red 2s ease-in-out infinite' }} />
          <p className="text-sm font-semibold text-[var(--white)] tracking-tight truncate">{routine.name}</p>
          <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">
            {completedSets} / {totalSets} done
          </span>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Rest timer config */}
          <div className="hidden sm:flex items-center bg-[var(--bg-2)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-1.5 gap-1.5">
            <Timer className="w-3 h-3 text-[var(--muted)]" />
            <NumericInput
              integer
              min={0}
              value={configuredRestTime}
              onChange={n => setConfiguredRestTime(n)}
              className="bg-transparent text-[var(--text)] text-[11px] font-mono outline-none w-7 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="font-mono text-[10px] text-[var(--muted)]">sec</span>
          </div>
          {/* Mobile rest timer config */}
          <div className="flex sm:hidden items-center bg-[var(--bg-2)] border border-[var(--border)] rounded-[var(--radius-sm)] px-2 py-1.5 gap-1">
            <Timer className="w-3 h-3 text-[var(--muted)]" />
            <NumericInput
              integer
              min={0}
              value={configuredRestTime}
              onChange={n => setConfiguredRestTime(n)}
              className="bg-transparent text-[var(--text)] text-[11px] font-mono outline-none w-7 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="font-mono text-[9px] text-[var(--muted)]">s</span>
          </div>
          {/* Unit toggle */}
          <div className="flex bg-[var(--bg-2)] border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden">
            <button 
              onClick={() => handleUnitChange('lbs')} 
              className={`px-2.5 py-1.5 text-[10px] font-bold font-sans uppercase tracking-[0.06em] transition-colors border-none cursor-pointer ${unit === 'lbs' ? 'bg-[var(--bg-3)] text-white' : 'bg-transparent text-[var(--muted)]'}`}
            >
              lbs
            </button>
            <button 
              onClick={() => handleUnitChange('kgs')} 
              className={`px-2.5 py-1.5 text-[10px] font-bold font-sans uppercase tracking-[0.06em] transition-colors border-none cursor-pointer ${unit === 'kgs' ? 'bg-[var(--bg-3)] text-white' : 'bg-transparent text-[var(--muted)]'}`}
            >
              kgs
            </button>
          </div>
          <button onClick={() => setShowAbortConfirm(true)} className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-full px-3 sm:px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors">Abort</button>
          <button
            onClick={finishWorkout}
            disabled={saving}
            className="bg-[var(--red)] text-white border-none rounded-full px-4 sm:px-5 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Finish
          </button>
        </div>
      </header>

      {/* Exercise area OR timer takeover */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
        {/* Full-screen rest timer takeover — always in DOM so exercise scroll position is preserved */}
        <div style={{ display: isTimerTakeover ? 'flex' : 'none' }} className="flex-col items-center justify-center py-10 px-8 text-center min-h-full relative">
            <button
              onClick={() => setIsTimerMinimized(true)}
              className="absolute top-0 right-0 p-2 text-[var(--muted)] hover:text-[var(--text-2)] transition-colors bg-transparent border-none cursor-pointer"
              title="Minimise timer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-4">Resting</p>

            <p className={`font-mono text-[56px] sm:text-[80px] font-bold leading-none tracking-tight mb-7 ${isLowTime ? 'text-[var(--red)]' : 'text-[var(--white)]'}`}
               style={isLowTime ? { animation: 'pulse-red 1s ease-in-out infinite' } : {}}>
              {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-[280px] h-0.5 bg-[var(--bg-3)] rounded-full mb-5 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${isLowTime ? 'bg-[var(--red)]' : 'bg-[var(--red)]'}`} style={{ width: `${timerProgress}%` }} />
            </div>

            {/* Next set context */}
            {(() => {
              const next = getNextSetContext();
              if (!next) return null;
              return (
                <div className="flex flex-col items-center gap-1 mb-8">
                  <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--muted)]">
                    Up next
                  </p>
                  <p className="text-[18px] font-bold text-[var(--white)] tracking-tight">
                    {next.exerciseName}
                  </p>
                  <p className="text-[13px] text-[var(--dim)] font-medium">
                    Set <strong className="text-[var(--text)]">{next.setNum} / {next.totalSets}</strong>
                    {' · '}{next.weight} {unit} × {next.reps} reps
                  </p>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  timerEndTimeRef.current = timerEndTimeRef.current + 30_000;
                  setRestTimeRemaining(prev => prev + 30);
                }}
                className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-5 py-2.5 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors"
              >
                +30s
              </button>
              <button
                onClick={() => { setRestTimeRemaining(0); setIsTimerActive(false); setIsTimerMinimized(false); }}
                className="bg-transparent text-[var(--text-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-5 py-2.5 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--white)] transition-colors"
              >
                Skip Rest
              </button>
            </div>
          </div>
        {/* Exercise cards — always in DOM, hidden during timer takeover */}
        <div style={{ display: isTimerTakeover ? 'none' : 'block' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 gap-2.5 max-w-4xl mx-auto">
                {exercises.map((ex, idx) => (
                  <SortableExerciseCard
                    key={`${ex.name}-${idx}`}
                    id={String(idx)}
                    ex={ex}
                    idx={idx}
                    isActive={idx === activeExerciseIndex}
                    unit={unit}
                    previousHistory={previousHistory}
                    toDisplayUnit={toDisplayUnit}
                    fromDisplayUnit={fromDisplayUnit}
                    updateSet={updateSet}
                    updateExerciseName={updateExerciseName}
                    updateExerciseField={updateExerciseField}
                    addSet={addSet}
                    deleteSet={deleteSet}
                    deleteExercise={deleteExercise}
                  />
                ))}

                {/* Add exercise button */}
                <button
                  onClick={() => { setShowAddModal(true); setAddModalBodyPart(''); }}
                  className="w-full py-3.5 border border-dashed border-[var(--border-2)] bg-transparent text-[var(--muted)] rounded-[var(--radius)] font-sans text-[12px] font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors hover:border-[var(--muted)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Exercise
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Status footer */}
      <footer className="h-[46px] sm:h-[38px] border-t border-[var(--border)] bg-[var(--bg)] flex items-center px-4 sm:px-6 justify-between shrink-0 sticky bottom-0 z-10 safe-bottom">
        <div className="flex gap-6 font-mono text-[10px] text-[var(--muted)]">
          <span>Sets <span className="text-[var(--white)] font-bold">{completedSets} / {totalSets}</span></span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="w-[5px] h-[5px] bg-[var(--red)] rounded-full" style={{ animation: 'pulse-red 2s ease-in-out infinite' }} />
          <span className="text-[10px] text-[var(--muted)]">LIVE</span>
        </div>
      </footer>

      {/* Floating minimized timer pill */}
      {restTimeRemaining > 0 && isTimerActive && isTimerMinimized && (
        <button
          onClick={() => setIsTimerMinimized(false)}
          className="fixed left-1/2 -translate-x-1/2 bottom-[54px] z-40 flex items-center gap-3 bg-[var(--red)] rounded-full px-5 py-2.5 cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
        >
          <span
            className="font-mono text-[15px] font-bold leading-none text-white"
            style={isLowTime ? { animation: 'pulse-red 1s ease-in-out infinite' } : {}}
          >
            {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
          </span>
          <span className="text-[10px] text-white/80 uppercase tracking-[0.08em] font-sans font-semibold">
            Tap to expand
          </span>
        </button>
      )}

      {/* Add Exercise Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-[var(--bg-1)] border border-[var(--border-2)] rounded-[12px] w-full max-w-[440px] max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-[18px] py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-[var(--white)] tracking-tight">Add Exercise</h3>
              <button onClick={() => { setShowAddModal(false); setAddModalBodyPart(''); }} className="text-[var(--muted)] hover:text-white transition-colors bg-transparent border-none cursor-pointer">
                <X className="w-[15px] h-[15px]" />
              </button>
            </div>
            {/* Search */}
            <div className="px-[18px] py-3.5 border-b border-[var(--border)] shrink-0">
              <div className="relative">
                <Search className="absolute left-[11px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[var(--muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search exercises…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] text-[var(--white)] outline-none focus:border-[var(--red)] pl-9 placeholder:text-[var(--muted)]"
                  autoFocus
                />
              </div>
              {routine.bodyPart && (
                <label className="flex items-center gap-2 text-[11px] text-[var(--dim)] font-medium cursor-pointer mt-2.5">
                  <input
                    type="checkbox"
                    checked={filterByBodyPart}
                    onChange={(e) => setFilterByBodyPart(e.target.checked)}
                    className="w-[13px] h-[13px] cursor-pointer"
                    style={{ accentColor: '#C0392B' }}
                  />
                  <span>Show only {routine.bodyPart} exercises</span>
                </label>
              )}
            </div>
            <div className="px-[18px] py-2.5 border-b border-[var(--border)] shrink-0">
              <select
                value={addModalBodyPart}
                onChange={(e) => setAddModalBodyPart(e.target.value)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] text-[var(--white)] outline-none focus:border-[var(--red)]"
              >
                <option value="">Select body part…</option>
                {BODY_PARTS.map(bp => (
                  <option key={bp} value={bp}>{bp}</option>
                ))}
              </select>
            </div>
            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {searchQuery.trim() !== '' && (
                <>
                  <button
                    onClick={() => addModalBodyPart && addExercise(searchQuery, undefined, 'strength', addModalBodyPart)}
                    disabled={!addModalBodyPart}
                    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Strength
                  </button>
                  <button
                    onClick={() => addModalBodyPart && addExercise(searchQuery, undefined, 'cardio', addModalBodyPart)}
                    disabled={!addModalBodyPart}
                    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Cardio
                  </button>
                </>
              )}
              {(Object.values(previousHistory) as {name: string, sets: TrackedSet[], unit: string, bodyPart?: string, type?: 'strength' | 'cardio', duration?: number, distance?: number}[])
                .filter(hist => !exercises.some(ex => ex.name.toLowerCase().trim() === hist.name.toLowerCase().trim()))
                .filter(hist => hist.name.toLowerCase().includes(searchQuery.toLowerCase()) || (hist.bodyPart && hist.bodyPart.toLowerCase().includes(searchQuery.toLowerCase())))
                .filter(hist => !filterByBodyPart || !routine.bodyPart || (hist.bodyPart && hist.bodyPart.toLowerCase() === routine.bodyPart.toLowerCase()))
                .sort((a,b) => a.name.localeCompare(b.name))
                .map((hist) => (
                  <button
                    key={hist.name}
                    onClick={() => (hist.bodyPart || addModalBodyPart) && addExercise(hist.name, hist, undefined, addModalBodyPart || undefined)}
                    disabled={!hist.bodyPart && !addModalBodyPart}
                    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--text)] bg-transparent border-none cursor-pointer flex justify-between items-center hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>{hist.name} <span className="font-mono text-[9px] text-[var(--muted)] ml-1.5">{hist.sets.length} sets prev.</span></span>
                    {hist.bodyPart && <span className="font-mono text-[9px] text-[var(--muted)] bg-[var(--bg-2)] border border-[var(--border)] px-2 py-0.5 rounded-full">{hist.bodyPart}</span>}
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── CALORIE MODAL ── */}
      {showCalorieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl w-full max-w-[360px] p-6 flex flex-col gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Workout Complete</p>
              <h2 className="text-[22px] font-black uppercase text-[var(--white)] leading-tight">{routine.name}</h2>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Calories burnt
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 450"
                  value={calorieInput}
                  onChange={e => { setCalorieInput(e.target.value); setCalorieError(''); }}
                  className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--white)] text-[15px] font-mono outline-none focus:border-[var(--red)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCalorieSave(); if (e.key === 'Escape') handleCalorieSkip(); }}
                />
                <span className="text-[13px] font-semibold text-[var(--muted)]">kcal</span>
              </div>
              {calorieError && <p className="text-[11px] text-[var(--red)]">{calorieError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCalorieSkip}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--muted)] transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleCalorieSave}
                disabled={calorieSaving}
                className="flex-1 py-2.5 rounded-lg bg-[var(--red)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {calorieSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abort Confirmation Modal */}
      {showAbortConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[var(--bg-1)] border border-[var(--border-2)] rounded-[12px] w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-sm font-bold text-white mb-2">Abort Session?</h3>
              <p className="text-[11px] text-[var(--text-2)] font-mono leading-relaxed">
                All progress will be discarded. This cannot be undone.
              </p>
            </div>
            <div className="flex border-t border-[var(--border)]">
              <button 
                onClick={() => setShowAbortConfirm(false)}
                className="flex-1 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-2)] hover:text-white hover:bg-[var(--bg-2)] transition-colors bg-transparent border-none cursor-pointer"
              >
                Continue Workout
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem(draftKey);
                  onFinish();
                }}
                className="flex-1 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-red-500 hover:bg-red-900/20 border-l border-[var(--border)] transition-colors bg-transparent cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
