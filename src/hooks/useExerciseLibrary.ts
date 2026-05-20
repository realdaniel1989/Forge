import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ExerciseEntry, BodyPart, normalizeExerciseName } from '../types';
import { handleFirestoreError, OperationType } from '../firestoreUtils';

export function useExerciseLibrary() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
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
    if (entries.some(e => e.nameKey === nameKey)) return;
    try {
      const docRef = await addDoc(collection(db, 'exerciseLibrary'), {
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt: Date.now(),
      });
      const newEntry: ExerciseEntry = {
        id: docRef.id,
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt: Date.now(),
      };
      setEntries(prev =>
        prev.some(e => e.nameKey === nameKey)
          ? prev
          : [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'exerciseLibrary');
    }
  }, [user, entries]);

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

    const batch = writeBatch(db);

    // Retag workoutLogs
    const logsSnap = await getDocs(
      query(collection(db, 'workoutLogs'), where('userId', '==', user.uid))
    );
    logsSnap.forEach(logDoc => {
      const exs = (logDoc.data().exercises ?? []) as Array<Record<string, unknown>>;
      if (exs.some(ex => normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey)) {
        batch.update(logDoc.ref, {
          exercises: exs.map(ex =>
            normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey
              ? { ...ex, name: primary.name, bodyPart: primary.bodyPart }
              : ex
          ),
        });
      }
    });

    // Retag routines
    const routinesSnap = await getDocs(
      query(collection(db, 'routines'), where('userId', '==', user.uid))
    );
    routinesSnap.forEach(routineDoc => {
      const exs = (routineDoc.data().exercises ?? []) as Array<Record<string, unknown>>;
      if (exs.some(ex => normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey)) {
        batch.update(routineDoc.ref, {
          exercises: exs.map(ex =>
            normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey
              ? { ...ex, name: primary.name, bodyPart: primary.bodyPart }
              : ex
          ),
        });
      }
    });

    // Delete secondary from library
    batch.delete(doc(db, 'exerciseLibrary', secondary.id));

    await batch.commit(); // throws on failure — caller catches
    setEntries(prev => prev.filter(e => e.id !== secondary.id));
  }, [user]);

  return { entries, loading, error, addToLibrary, updateBodyPart, mergeExercises };
}
