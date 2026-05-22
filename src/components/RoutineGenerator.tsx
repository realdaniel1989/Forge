import React, { useState } from 'react';
import { Loader2, Bookmark } from 'lucide-react';
import { Exercise, BodyPart } from '../types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { getPlannedSets, formatTempo } from '../tempoUtils';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const RoutineGenerator: React.FC<{ onRoutineSaved: () => void }> = ({ onRoutineSaved }) => {
  const { user } = useAuth();
  const { addToLibrary } = useExerciseLibrary();
  const [bodyPart, setBodyPart] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRoutine, setGeneratedRoutine] = useState<{ name: string; exercises: Exercise[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!bodyPart.trim()) return;
    setLoading(true);
    setGeneratedRoutine(null);
    setError(null);
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyPart }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedRoutine(data);
      } else {
        setError(data.error || 'Failed to generate routine');
      }
    } catch {
      setError('Failed to generate routine. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const saveRoutine = async () => {
    if (!generatedRoutine || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'routines'), {
        userId: user.uid,
        name: generatedRoutine.name,
        bodyPart,
        exercises: generatedRoutine.exercises,
        isGenerated: true,
        createdAt: Date.now(),
      });
      onRoutineSaved();
      // best-effort library sync — never blocks or fails the save
      Promise.allSettled(
        generatedRoutine.exercises
          .filter(ex => ex.name && ex.bodyPart)
          .map(ex => addToLibrary(ex.name, ex.bodyPart as BodyPart, ex.type ?? 'strength'))
      );
      setGeneratedRoutine(null);
      setBodyPart('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'routines');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>
            {generatedRoutine ? `AI Generator · ${bodyPart}` : 'Powered by Qwen'}
          </p>
          <h1
            className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none"
            style={{ ...condensed, letterSpacing: '-0.02em' }}
          >
            {generatedRoutine ? generatedRoutine.name : 'AI Generator'}
          </h1>
        </div>
        {generatedRoutine && (
          <button
            onClick={saveRoutine}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-[10px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:bg-[var(--action-hover)] transition-colors disabled:opacity-50"
            style={condensed}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}
            Save Routine
          </button>
        )}
      </div>

      {/* ── INPUT CARD ── */}
      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-[var(--hairline)] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Target Muscle Group</span>
          <span className="text-[11px] text-[var(--stone)] uppercase tracking-[0.08em]" style={condensed}>Required</span>
        </div>
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <input
              type="text"
              className="w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-4 py-3 text-[14px] font-medium text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)] placeholder:text-[var(--stone)]"
              placeholder="e.g. Chest, Legs, Shoulders…"
              value={bodyPart}
              onChange={e => setBodyPart(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>
          <button
            onClick={generate}
            disabled={loading || !bodyPart.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--canvas)] border-none text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-40"
            style={condensed}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3c-1 3-3 5-5 6 2 1 4 3 5 6 1-3 3-5 5-6-2-1-4-3-5-6z"/>
              </svg>
            )}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {error && (
          <div className="mx-5 mb-5 bg-[var(--surface-2)] border border-[var(--hairline-2)] rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[var(--action)]">{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--stone)] hover:text-[var(--ash)] text-base cursor-pointer border-none bg-none">&times;</button>
          </div>
        )}
      </div>

      {/* ── EMPTY PLACEHOLDER ── */}
      {!generatedRoutine && !loading && (
        <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-12 px-6 text-center">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--stone)]" style={condensed}>
            Your generated routine will appear here
          </p>
        </div>
      )}

      {/* ── GENERATED EXERCISES ── */}
      {generatedRoutine && (
        <div className="flex flex-col border-t border-[var(--hairline)]">
          {generatedRoutine.exercises.map((ex, idx) => (
            <div key={idx} className="py-5 border-b border-[var(--hairline)]">
              <div className="flex items-start gap-5">
                <span
                  className="text-[13px] font-bold text-[var(--stone)] w-7 shrink-0 mt-0.5"
                  style={condensed}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4 mb-1.5">
                    <h3 className="text-[17px] font-bold text-[var(--ink)]" style={condensed}>
                      {ex.name}
                    </h3>
                    <span
                      className="text-[13px] font-semibold text-[var(--stone)] shrink-0"
                      style={condensed}
                    >
                      {ex.type === 'cardio' ? `${ex.duration} min` : (() => {
                        const planned = getPlannedSets(ex);
                        if (planned.length === 0) return '—';
                        const headlineReps = planned[0].reps;
                        const repsVary = planned.some(p => p.reps !== headlineReps);
                        return `${planned.length} × ${headlineReps}${repsVary ? '+' : ''}`;
                      })()}
                    </span>
                  </div>
                  {ex.tip && (
                    <p className="text-[13px] text-[var(--stone)] leading-relaxed">{ex.tip}</p>
                  )}
                  {(() => {
                    const planned = getPlannedSets(ex);
                    if (planned.length === 0) return null;
                    const w = planned[0].weight;
                    const tempoStr = formatTempo(planned[0].tempo);
                    if (w <= 0 && !tempoStr) return null;
                    return (
                      <p className="text-[11px] text-[var(--stone)] mt-1 uppercase tracking-[0.06em]" style={condensed}>
                        {w > 0 && <>Suggested: {w} kgs</>}
                        {w > 0 && tempoStr && <span className="mx-1.5">·</span>}
                        {tempoStr && <span className="font-mono normal-case tracking-normal">Tempo {tempoStr}</span>}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
