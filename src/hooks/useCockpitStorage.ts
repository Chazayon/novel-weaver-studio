import { useCallback, useEffect, useState, type SetStateAction } from 'react';

export interface SavedOutput {
  content: string;
  name: string;
  type: string;
}

export function useCockpitStorage<TPhaseOutput = unknown>(projectId?: string | null) {
  const [savedOutputs, setSavedOutputs] = useState<Record<string, SavedOutput>>({});
  const [phaseOutputs, setPhaseOutputs] = useState<Record<number, TPhaseOutput>>({});

  const persistSavedOutputs = useCallback((next: Record<string, SavedOutput>) => {
    if (!projectId) return;
    try {
      localStorage.setItem(`novel-weaver-saved-${projectId}`, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to persist saved outputs:', error);
    }
  }, [projectId]);

  const persistPhaseOutputs = useCallback((next: Record<number, TPhaseOutput>) => {
    if (!projectId) return;
    try {
      localStorage.setItem(`novel-weaver-outputs-${projectId}`, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to persist phase outputs:', error);
    }
  }, [projectId]);

  const setSavedOutputsAndPersist = useCallback((updater: SetStateAction<Record<string, SavedOutput>>) => {
    setSavedOutputs((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Record<string, SavedOutput>) => Record<string, SavedOutput>)(prev) : updater;
      persistSavedOutputs(next);
      return next;
    });
  }, [persistSavedOutputs]);

  const setPhaseOutputsAndPersist = useCallback((updater: SetStateAction<Record<number, TPhaseOutput>>) => {
    setPhaseOutputs((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Record<number, TPhaseOutput>) => Record<number, TPhaseOutput>)(prev) : updater;
      persistPhaseOutputs(next);
      return next;
    });
  }, [persistPhaseOutputs]);

  useEffect(() => {
    if (!projectId) {
      setSavedOutputs({});
      setPhaseOutputs({});
      return;
    }

    try {
      const storedSaved = localStorage.getItem(`novel-weaver-saved-${projectId}`);
      if (storedSaved) {
        setSavedOutputs(JSON.parse(storedSaved));
      } else {
        setSavedOutputs({});
      }

      const storedOutputs = localStorage.getItem(`novel-weaver-outputs-${projectId}`);
      if (storedOutputs) {
        setPhaseOutputs(JSON.parse(storedOutputs));
      } else {
        setPhaseOutputs({});
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      setSavedOutputs({});
      setPhaseOutputs({});
    }
  }, [projectId]);

  return {
    savedOutputs,
    setSavedOutputs,
    setSavedOutputsAndPersist,
    phaseOutputs,
    setPhaseOutputs,
    setPhaseOutputsAndPersist,
    persistSavedOutputs,
    persistPhaseOutputs,
  };
}
