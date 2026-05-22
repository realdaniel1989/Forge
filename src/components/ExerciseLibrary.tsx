import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BODY_PARTS, BodyPart, ExerciseEntry } from '../types';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const ExerciseLibrary: React.FC = () => {
  const { entries, loading, error, addToLibrary, updateBodyPart, updateName, mergeExercises } = useExerciseLibrary();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [nameEditError, setNameEditError] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addBodyPart, setAddBodyPart] = useState<BodyPart | ''>('');
  const [addType, setAddType] = useState<'strength' | 'cardio'>('strength');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Merge modal
  const [mergeSource, setMergeSource] = useState<ExerciseEntry | null>(null);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState<ExerciseEntry | null>(null);
  const [mergeConfirming, setMergeConfirming] = useState(false);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const closeMergeModal = () => {
    setMergeSource(null);
    setMergeTarget(null);
    setMergeConfirming(false);
    setMergeSearch('');
    setMergeError(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(e => e.name.toLowerCase().includes(q));
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map: Record<string, ExerciseEntry[]> = {};
    for (const entry of filtered) {
      if (!map[entry.bodyPart]) map[entry.bodyPart] = [];
      map[entry.bodyPart].push(entry);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleAddSave = async () => {
    if (!addName.trim()) { setAddError('Enter an exercise name.'); return; }
    if (!addBodyPart) { setAddError('Select a body part.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      await addToLibrary(addName, addBodyPart as BodyPart, addType);
      setShowAddModal(false);
      setAddName('');
      setAddBodyPart('');
      setAddType('strength');
    } catch {
      setAddError('Failed to save. Please try again.');
    } finally {
      setAddSaving(false);
    }
  };

  const handleMergeConfirm = async () => {
    if (!mergeSource || !mergeTarget) return;
    setMergeSaving(true);
    setMergeError(null);
    try {
      await mergeExercises(mergeTarget, mergeSource); // primary=target (keep), secondary=source (remove)
      showToast(`"${mergeSource.name}" merged into "${mergeTarget.name}"`);
      closeMergeModal();
    } catch {
      setMergeError('Merge failed. No changes were made. Try again.');
    } finally {
      setMergeSaving(false);
    }
  };

  const startNameEdit = (ex: { id: string; name: string }) => {
    setEditingNameId(ex.id);
    setEditingNameValue(ex.name);
    setNameEditError(null);
  };

  const commitNameEdit = async (id: string) => {
    if (!editingNameValue.trim()) { cancelNameEdit(); return; }
    try {
      await updateName(id, editingNameValue);
      setEditingNameId(null);
      setNameEditError(null);
    } catch (e: any) {
      setNameEditError(e?.message ?? 'Failed to save name.');
    }
  };

  const cancelNameEdit = () => {
    setEditingNameId(null);
    setEditingNameValue('');
    setNameEditError(null);
  };

  const selectClass = "bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)]";

  if (loading) {
    return (
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10" style={condensed}>
        Loading…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink)] text-[var(--canvas)] px-4 py-2 rounded-full text-[12px] font-semibold shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>
            {entries.length} exercise{entries.length !== 1 ? 's' : ''} saved
          </p>
          <h1
            className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none"
            style={{ ...condensed, letterSpacing: '-0.02em' }}
          >
            My Exercises
          </h1>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setAddName(''); setAddBodyPart(''); setAddType('strength'); setAddError(''); }}
          className="flex items-center gap-2 px-5 py-[10px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity"
          style={condensed}
        >
          + Add Exercise
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-[var(--action)] text-center py-4 mb-4">{error}</p>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)] placeholder:text-[var(--stone)]"
        />
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-10 text-center">
          <p className="text-[12px] uppercase tracking-[0.1em] text-[var(--stone)]" style={condensed}>
            No exercises yet — save a routine to populate your library.
          </p>
        </div>
      )}

      {entries.length > 0 && grouped.length === 0 && search.trim() !== '' && (
        <p className="text-[12px] text-center text-[var(--stone)] py-6" style={condensed}>
          No exercises match "{search}".
        </p>
      )}

      {/* Grouped list */}
      {grouped.map(([bodyPart, exs]) => (
        <div key={bodyPart} className="mb-6">
          <div
            className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--stone)] mb-2 pb-2 border-b border-[var(--hairline)] flex justify-between"
            style={condensed}
          >
            <span>{bodyPart}</span>
            <span>{exs.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {exs.map(ex => (
              <div key={ex.id} className="flex flex-col bg-[var(--surface)] rounded-lg">
                <div className="flex justify-between items-center px-3 py-2.5">
                {editingNameId === ex.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                    <input
                      autoFocus
                      value={editingNameValue}
                      onChange={e => { setEditingNameValue(e.target.value); setNameEditError(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitNameEdit(ex.id);
                        if (e.key === 'Escape') cancelNameEdit();
                      }}
                      onBlur={() => commitNameEdit(ex.id)}
                      className="flex-1 bg-[var(--canvas)] border border-[var(--ash)] rounded-lg px-2 py-1 text-[13px] font-semibold text-[var(--ink)] outline-none min-w-0"
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); cancelNameEdit(); }}
                      className="text-[var(--stone)] hover:text-[var(--ink)] bg-transparent border-none cursor-pointer text-[12px] shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startNameEdit(ex)}
                    title="Edit name"
                    className="text-[13px] font-semibold text-[var(--ink)] bg-transparent border-none cursor-pointer text-left hover:text-[var(--action)] transition-colors p-0 flex-1 min-w-0 mr-3 truncate"
                  >
                    {ex.name}
                  </button>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[9px] bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-full px-2 py-0.5 text-[var(--stone)] uppercase tracking-[.06em]">
                    {ex.type}
                  </span>
                  {/* Inline body part edit */}
                  {editingId === ex.id ? (
                    <select
                      autoFocus
                      value={ex.bodyPart}
                      onChange={async e => {
                        const newVal = e.target.value as BodyPart;
                        try {
                          await updateBodyPart(ex.id, newVal);
                          setEditingId(null);
                        } catch {
                          setEditingId(null); // close edit; hook already reverted optimistic update
                          showToast('Failed to update body part.');
                        }
                      }}
                      onBlur={() => setEditingId(null)}
                      className={selectClass}
                    >
                      {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingId(ex.id)}
                      title="Edit body part"
                      className="text-[11px] text-[var(--stone)] hover:text-[var(--ink)] border-none bg-transparent cursor-pointer transition-colors px-1"
                    >
                      ✎
                    </button>
                  )}
                  <button
                    onClick={() => { setMergeSource(ex); setMergeSearch(''); setMergeTarget(null); setMergeConfirming(false); setMergeError(null); }}
                    className="text-[10px] font-bold text-[var(--action)] hover:opacity-75 border-none bg-transparent cursor-pointer transition-opacity uppercase tracking-[.04em]"
                  >
                    merge
                  </button>
                </div>
                </div>
                {editingNameId === ex.id && nameEditError && (
                  <p className="text-[10px] text-[var(--action)] px-3 pb-2">{nameEditError}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { if (!addSaving) setShowAddModal(false); }}
        >
          <div
            className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-[var(--radius)] p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-5" style={condensed}>
              Add Exercise
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Name
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Bench Press"
                  autoFocus
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)] placeholder:text-[var(--stone)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Body Part *
                </label>
                <select
                  value={addBodyPart}
                  onChange={e => setAddBodyPart(e.target.value as BodyPart)}
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)]"
                >
                  <option value="" disabled>Select body part…</option>
                  {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Type
                </label>
                <div className="flex rounded-lg overflow-hidden border border-[var(--hairline-2)]">
                  <button
                    onClick={() => setAddType('strength')}
                    className={`flex-1 py-2 text-[12px] font-bold uppercase tracking-[.06em] border-none cursor-pointer transition-colors ${addType === 'strength' ? 'bg-[var(--ink)] text-[var(--canvas)]' : 'bg-[var(--surface)] text-[var(--stone)]'}`}
                  >
                    Strength
                  </button>
                  <button
                    onClick={() => setAddType('cardio')}
                    className={`flex-1 py-2 text-[12px] font-bold uppercase tracking-[.06em] border-none cursor-pointer transition-colors ${addType === 'cardio' ? 'bg-[var(--ink)] text-[var(--canvas)]' : 'bg-[var(--surface)] text-[var(--stone)]'}`}
                  >
                    Cardio
                  </button>
                </div>
              </div>
              {addError && <p className="text-[11px] text-[var(--action)]">{addError}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={addSaving}
                  className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSave}
                  disabled={addSaving || !addName.trim() || !addBodyPart}
                  className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addSaving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MERGE MODAL ── */}
      {mergeSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { if (!mergeSaving) closeMergeModal(); }}
        >
          <div
            className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-[var(--radius)] p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {!mergeConfirming ? (
              /* Step 1: pick primary */
              <>
                <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-1" style={condensed}>
                  Merge Exercise
                </h2>
                <p className="text-[12px] text-[var(--stone)] mb-4">
                  Pick the exercise to keep.{' '}
                  <strong className="text-[var(--action)]">{mergeSource.name}</strong> will be removed and all its history retagged.
                </p>
                <input
                  type="text"
                  placeholder="Search for primary exercise…"
                  value={mergeSearch}
                  onChange={e => { setMergeSearch(e.target.value); setMergeTarget(null); }}
                  autoFocus
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)] placeholder:text-[var(--stone)] mb-3"
                />
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto mb-4">
                  {entries
                    .filter(e =>
                      e.id !== mergeSource.id &&
                      e.name.toLowerCase().includes(mergeSearch.toLowerCase())
                    )
                    .map(e => (
                      <button
                        key={e.id}
                        onClick={() => setMergeTarget(e)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-colors flex justify-between items-center ${
                          mergeTarget?.id === e.id
                            ? 'bg-[var(--action)] text-white'
                            : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--hairline)]'
                        }`}
                      >
                        <span>{e.name}</span>
                        <span className="text-[10px] opacity-60 ml-2">{e.bodyPart}</span>
                      </button>
                    ))}
                  {entries.filter(e => e.id !== mergeSource.id && e.name.toLowerCase().includes(mergeSearch.toLowerCase())).length === 0 && (
                    <p className="text-[11px] text-[var(--stone)] text-center py-3" style={condensed}>No match found.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeMergeModal}
                    className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!mergeTarget}
                    onClick={() => setMergeConfirming(true)}
                    className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: confirm */
              <>
                <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-4" style={condensed}>
                  Confirm Merge
                </h2>
                <div className="bg-[var(--surface)] border border-[var(--action)] rounded-lg p-3 mb-3">
                  <div className="text-[9px] text-[var(--action)] uppercase tracking-[.1em] mb-1 font-bold">
                    Will be removed
                  </div>
                  <div className="font-bold text-[13px]">{mergeSource.name}</div>
                </div>
                <div className="text-center text-[16px] text-[var(--stone)] mb-3">↓</div>
                <div className="bg-[var(--surface)] border border-[var(--success,#16a34a)] rounded-lg p-3 mb-4">
                  <div className="text-[9px] text-[var(--success,#16a34a)] uppercase tracking-[.1em] mb-1 font-bold">
                    Keep as primary
                  </div>
                  <div className="font-bold text-[13px]">{mergeTarget?.name}</div>
                </div>
                <p className="text-[11px] text-[var(--stone)] mb-4">
                  All past workouts and routines using{' '}
                  <strong className="text-[var(--ink)]">{mergeSource.name}</strong> will be updated to{' '}
                  <strong className="text-[var(--ink)]">{mergeTarget?.name}</strong>. This cannot be undone.
                </p>
                {mergeError && (
                  <p className="text-[11px] text-[var(--action)] mb-3">{mergeError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setMergeConfirming(false)}
                    disabled={mergeSaving}
                    className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleMergeConfirm}
                    disabled={mergeSaving}
                    className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {mergeSaving ? 'Merging…' : 'Confirm Merge'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
