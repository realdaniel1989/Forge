import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, writeBatch, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ExerciseEntry, BodyPart, normalizeExerciseName } from '../types';
import { handleFirestoreError, OperationType } from '../firestoreUtils';

const BATCH_SIZE = 498;

export function useExerciseLibrary() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'exerciseLibrary'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const fetched: ExerciseEntry[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as ExerciseEntry));
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setEntries(fetched);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'exerciseLibrary');
      setError('Failed to load exercise library');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addToLibrary = useCallback(async (
    name: string,
    bodyPart: BodyPart,
    type: 'strength' | 'cardio'
  ): Promise<void> => {
    if (!user || !name.trim()) return;
    const nameKey = normalizeExerciseName(name);
    // Use a ref-check approach: attempt write only if not already present
    let shouldWrite = false;
    setEntries(prev => {
      if (prev.some(e => e.nameKey === nameKey)) return prev;
      shouldWrite = true;
      return prev;
    });
    if (!shouldWrite) return;
    try {
      const createdAt = Date.now();
      const docRef = await addDoc(collection(db, 'exerciseLibrary'), {
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt,
      });
      const newEntry: ExerciseEntry = {
        id: docRef.id,
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt,
      };
      setEntries(prev =>
        prev.some(e => e.nameKey === nameKey)
          ? prev
          : [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'exerciseLibrary');
      setError('Failed to add exercise to library');
    }
  }, [user]); // no 'entries' dependency — reads prev inside updater

  const updateBodyPart = useCallback(async (id: string, newBodyPart: BodyPart): Promise<void> => {
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === id ? { ...e, bodyPart: newBodyPart } : e));
    try {
      await updateDoc(doc(db, 'exerciseLibrary', id), { bodyPart: newBodyPart });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `exerciseLibrary/${id}`);
      // Revert on failure
      await fetchEntries();
      throw e;
    }
  }, [fetchEntries]);

  const mergeExercises = useCallback(async (
    primary: ExerciseEntry,
    secondary: ExerciseEntry
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    type FirestoreExercise = Record<string, unknown>;

    const applyRetag = (exs: FirestoreExercise[]): FirestoreExercise[] =>
      exs.map(ex =>
        normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey
          ? { ...ex, name: primary.name, bodyPart: primary.bodyPart }
          : ex
      );

    const hasSecondary = (exs: FirestoreExercise[]) =>
      exs.some(ex => normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey);

    // Collect all docs to update
    const updates: Array<{ ref: import('firebase/firestore').DocumentReference; exercises: FirestoreExercise[] }> = [];

    const logsSnap = await getDocs(
      query(collection(db, 'workoutLogs'), where('userId', '==', user.uid), limit(500))
    );
    logsSnap.forEach(logDoc => {
      const exs = (logDoc.data().exercises ?? []) as FirestoreExercise[];
      if (hasSecondary(exs)) updates.push({ ref: logDoc.ref, exercises: applyRetag(exs) });
    });

    const routinesSnap = await getDocs(
      query(collection(db, 'routines'), where('userId', '==', user.uid), limit(500))
    );
    routinesSnap.forEach(routineDoc => {
      const exs = (routineDoc.data().exercises ?? []) as FirestoreExercise[];
      if (hasSecondary(exs)) updates.push({ ref: routineDoc.ref, exercises: applyRetag(exs) });
    });

    // Chunk into batches of BATCH_SIZE, final batch includes the library delete
    const chunks: typeof updates[] = [];
    for (let i = 0; i < updates.length || chunks.length === 0; i += BATCH_SIZE) {
      chunks.push(updates.slice(i, i + BATCH_SIZE));
    }

    for (let ci = 0; ci < chunks.length; ci++) {
      const batch = writeBatch(db);
      for (const u of chunks[ci]) {
        batch.update(u.ref, { exercises: u.exercises });
      }
      if (ci === chunks.length - 1) {
        batch.delete(doc(db, 'exerciseLibrary', secondary.id));
      }
      await batch.commit();
    }

    setEntries(prev => prev.filter(e => e.id !== secondary.id));
  }, [user]);

  return { entries, loading, error, addToLibrary, updateBodyPart, mergeExercises };
}
