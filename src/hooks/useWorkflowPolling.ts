import { useEffect } from 'react';
import { apiClient } from '@/api/client';

interface PendingReview {
  content?: string;
  description?: string;
  expectedOutputs?: string[];
}

interface UseWorkflowPollingArgs<TOutputs> {
  projectId?: string | null;
  phase: number;
  workflowId: string | null;
  refetchProgress: () => Promise<unknown>;

  setCompletionData: (data: TOutputs) => void;
  setIsCompletionDialogOpen: (open: boolean) => void;

  setReviewContent: (content: string) => void;
  setReviewDescription: (description: string) => void;
  setReviewExpectedOutputs?: (expectedOutputs: string[]) => void;
  setIsReviewDialogOpen: (open: boolean) => void;

  setRunningPhases: (updater: (prev: Set<number>) => Set<number>) => void;
  setWorkflowId: (workflowId: string | null) => void;

  setPhaseOutputsAndPersist: (updater: (prev: Record<number, TOutputs>) => Record<number, TOutputs>) => void;
}

export function useWorkflowPolling<TOutputs>({
  projectId,
  phase,
  workflowId,
  refetchProgress,
  setCompletionData,
  setIsCompletionDialogOpen,
  setReviewContent,
  setReviewDescription,
  setReviewExpectedOutputs,
  setIsReviewDialogOpen,
  setRunningPhases,
  setWorkflowId,
  setPhaseOutputsAndPersist,
}: UseWorkflowPollingArgs<TOutputs>) {
  useEffect(() => {
    if (!workflowId || !projectId) return;

    const pollStatus = async () => {
      try {
        const statusData = await apiClient.getPhaseStatus(projectId, phase, workflowId);

        if (statusData.status === 'completed') {
          // Clear workflow ID immediately to stop polling before showing dialog
          setWorkflowId(null);
          
          let outputs = statusData.outputs;
          if (typeof outputs === 'string') {
            try {
              outputs = JSON.parse(outputs);
            } catch {
              // Leave as string; PhaseCompletionDialog has its own fallback rendering.
            }
          }
          console.log('=== PHASE COMPLETION DATA ===');
          console.log('Phase:', phase);
          console.log('Raw outputs:', JSON.stringify(outputs, null, 2));

          // Open dialog immediately; outputs can be enriched afterward.
          setCompletionData(outputs as TOutputs);
          setIsCompletionDialogOpen(true);
          setPhaseOutputsAndPersist((prev) => ({ ...prev, [phase]: outputs as TOutputs }));

          if (phase === 6 && projectId) {
            void (async () => {
              const base = outputs;
              if (!base || typeof base !== 'object') return;
              try {
                const outline = await apiClient.getArtifact(projectId, 'phase6_outputs/outline.md');
                const enriched = { ...(base as Record<string, unknown>), outline: outline.content };
                setCompletionData(enriched as TOutputs);
                setPhaseOutputsAndPersist((prev) => ({ ...prev, [phase]: enriched as TOutputs }));
              } catch (e) {
                try {
                  const outline = await apiClient.getArtifact(projectId, 'phase5_outputs/outline.md');
                  const enriched = { ...(base as Record<string, unknown>), outline: outline.content };
                  setCompletionData(enriched as TOutputs);
                  setPhaseOutputsAndPersist((prev) => ({ ...prev, [phase]: enriched as TOutputs }));
                } catch (e2) {
                  console.warn('Could not fetch outline artifact:', e2);
                }
              }
            })();
          }

          setRunningPhases((prev) => {
            const next = new Set(prev);
            next.delete(phase);
            return next;
          });

          await refetchProgress();
          setTimeout(() => refetchProgress(), 500);
          setTimeout(() => refetchProgress(), 1500);
          return;
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    const interval = setInterval(pollStatus, 1500);
    void pollStatus();

    return () => clearInterval(interval);
  }, [
    workflowId,
    projectId,
    phase,
    refetchProgress,
    setCompletionData,
    setIsCompletionDialogOpen,
    setReviewContent,
    setReviewDescription,
    setReviewExpectedOutputs,
    setIsReviewDialogOpen,
    setRunningPhases,
    setWorkflowId,
    setPhaseOutputsAndPersist,
  ]);
}
