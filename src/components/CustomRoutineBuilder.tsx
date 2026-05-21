import React, { useState } from 'react';
import { Exercise, BODY_PARTS, BodyPart, normalizeExerciseName } from '../types';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { Trash2 } from 'lucide-react';
import { NumericInput } from './NumericInput';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const CustomRoutineBuilder: React.FC<{ onCancel: () => void; onSave: () => void }> = ({ onCancel, onSave }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);
  const { entries: libraryEntries, addToLibrary } = useExerciseLibrary();
  const [activeSuggestionRow, setActiveSuggestionRow] = useState<number | null>(null);

  const addExercise = (type: 'strength' | 'cardio') => {
    if (type === 'strength') {
      setExercises([...exercises, { name: '', sets: 3, reps: 10, weight: 0, type: 'strength', bodyPart: undefined }]);
    } else {
      setExercises([...exercises, { name: '', type: 'cardio', duration: 30, distance: 0, bodyPart: 'Cardio' }]);
    }
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    const newEx = [...exercises];
    newEx[index] = { ...newEx[index], [field]: value };
    setExercises(newEx);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const saveRoutine = async () => {
    if (!user || !name.trim() || exercises.length === 0) return;
    const validExercises = exercises.filter(e => e.name.trim() !== '');
    if (!validExercises.every(e => e.bodyPart)) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'routines'), {
        userId: user.uid,
        name: name.trim(),
        exercises: validExercises,
        createdAt: Date.now(),
      });
      onSave(); // dismiss form immediately — routine is saved
      // best-effort library sync; never blocks or fails the save
      Promise.allSettled(
        validExercises.map(ex =>
          addToLibrary(ex.name, ex.bodyPart as BodyPart, (ex.type ?? 'strength') as 'strength' | 'cardio')
        )
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'routines');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)] placeholder:text-[var(--stone)]";
  const numInputClass = "w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-2.5 text-[13px] text-[var(--ink)] outline-none text-center transition-colors focus:border-[var(--ash)]";

  return (
    <div className="flex flex-col gap-0">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>
            New Routine
          </p>
          <h1
            className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none"
            style={{ ...condensed, letterSpacing: '-0.02em' }}
          >
            Build Routine
          </h1>
        </div>
        <button
          onClick={onCancel}
          className="px-5 py-[10px] rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
          style={condensed}
        >
          Discard
        </button>
      </div>

      {/* ── ROUTINE NAME ── */}
      <div className="mb-6">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-2" style={condensed}>
          Routine Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Upper Power A"
          className={inputClass}
        />
      </div>

      {/* ── EXERCISES ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)]" style={condensed}>
            Exercises
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => addExercise('strength')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
              style={condensed}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Strength
            </button>
            <button
              onClick={() => addExercise('cardio')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
              style={condensed}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Cardio
            </button>
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-10 text-center">
            <p className="text-[12px] uppercase tracking-[0.1em] text-[var(--stone)]" style={condensed}>
              No exercises added yet
            </p>
          </div>
        ) : (
          <div className="flex flex-col border-t border-[var(--hairline)]">
            {exercises.map((ex, idx) => (
              <div key={idx} className="py-4 border-b border-[var(--hairline)] flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[160px] relative">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                    {ex.type === 'cardio' ? 'Activity' : 'Exercise'}
                  </label>
                  <input
                    type="text"
                    value={ex.name}
                    onChange={e => {
                      updateExercise(idx, 'name', e.target.value);
                      setActiveSuggestionRow(idx);
                    }}
                    onFocus={() => setActiveSuggestionRow(idx)}
                    onBlur={() => setTimeout(() => setActiveSuggestionRow(null), 150)}
                    placeholder={ex.type === 'cardio' ? 'Treadmill Run' : 'Bench Press'}
                    className={inputClass}
                  />
                  {activeSuggestionRow === idx && ex.name.trim().length > 0 && (() => {
                    const key = normalizeExerciseName(ex.name);
                    const suggestions = ex.name.trim().length >= 2
                      ? libraryEntries
                          .filter(e => e.type === ex.type && e.nameKey.includes(key) && e.nameKey !== key)
                          .slice(0, 5)
                      : [];
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 z-20 bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg mt-1 shadow-lg overflow-hidden">
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            onMouseDown={() => {
                              updateExercise(idx, 'name', s.name);
                              updateExercise(idx, 'bodyPart', s.bodyPart);
                              setActiveSuggestionRow(null);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] flex justify-between items-center border-none bg-transparent cursor-pointer hover:bg-[var(--surface)] text-[var(--ink)] transition-colors"
                          >
                            <span>{s.name}</span>
                            <span className="text-[10px] text-[var(--stone)] ml-2">{s.bodyPart}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="w-28">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Body Part *</label>
                  <select
                    value={ex.bodyPart || ''}
                    onChange={e => updateExercise(idx, 'bodyPart', e.target.value || undefined)}
                    className={`w-full bg-[var(--canvas)] border rounded-lg px-2 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)] ${ex.name.trim() && !ex.bodyPart ? 'border-[var(--action)]' : 'border-[var(--hairline-2)]'}`}
                  >
                    <option value="" disabled>Select</option>
                    {BODY_PARTS.map(bp => (
                      <option key={bp} value={bp}>{bp}</option>
                    ))}
                  </select>
                </div>

                {ex.type === 'cardio' ? (
                  <>
                    <div className="w-16">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Min</label>
                      <NumericInput integer min={0} value={ex.duration || 0} onChange={n => updateExercise(idx, 'duration', n)} className={numInputClass} />
                    </div>
                    <div className="w-16">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Dist</label>
                      <NumericInput min={0} value={ex.distance || 0} onChange={n => updateExercise(idx, 'distance', n)} className={numInputClass} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Sets</label>
                      <NumericInput integer min={1} value={ex.sets || 1} onChange={n => updateExercise(idx, 'sets', n)} className={numInputClass} />
                    </div>
                    <div className="w-16">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Reps</label>
                      <NumericInput integer min={1} value={ex.reps || 1} onChange={n => updateExercise(idx, 'reps', n)} className={numInputClass} />
                    </div>
                  </>
                )}

                <button
                  onClick={() => removeExercise(idx)}
                  className="p-2.5 text-[var(--stone)] hover:text-[var(--action)] transition-colors border-none bg-none cursor-pointer mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SAVE BUTTON ── */}
      {(() => {
        const namedExercises = exercises.filter(e => e.name.trim() !== '');
        const missingBodyPart = namedExercises.length > 0 && !namedExercises.every(e => e.bodyPart);
        const disabled = saving || !name.trim() || exercises.length === 0 || missingBodyPart;
        return (
          <>
            {missingBodyPart && (
              <p className="text-[11px] text-[var(--action)] text-center mb-2 font-semibold uppercase tracking-[0.08em]" style={condensed}>
                Select a body part for every exercise to save.
              </p>
            )}
            <button
              onClick={saveRoutine}
              disabled={disabled}
              className="w-full py-[14px] rounded-full bg-[var(--action)] text-white border-none text-[14px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:bg-[var(--action-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={condensed}
            >
              {saving ? 'Saving…' : 'Save Routine'}
            </button>
          </>
        );
      })()}
    </div>
  );
};
