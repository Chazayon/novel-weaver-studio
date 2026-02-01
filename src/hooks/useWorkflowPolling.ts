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
        const response = await fetch(
          `http://localhost:8000/api/projects/${projectId}/phases/${phase}/status?workflow_id=${workflowId}`
        );
        const statusData = await response.json();

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

          if (phase === 6 && projectId) {
            try {
              const outline = await apiClient.getArtifact(projectId, 'phase6_outputs/outline.md');
              outputs = { ...outputs, outline: outline.content };
            } catch (e) {
              try {
                const outline = await apiClient.getArtifact(projectId, 'phase5_outputs/outline.md');
                outputs = { ...outputs, outline: outline.content };
              } catch (e2) {
                console.warn('Could not fetch outline artifact:', e2);
              }
            }
          }

          setCompletionData(outputs);
          setIsCompletionDialogOpen(true);

          setPhaseOutputsAndPersist((prev) => ({ ...prev, [phase]: outputs }));

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

        const pendingReview: PendingReview | undefined = statusData.outputs?.pending_review;
        if (pendingReview) {
          setReviewContent(pendingReview.content || '');
          setReviewDescription(pendingReview.description || '');
          setReviewExpectedOutputs?.(pendingReview.expectedOutputs || []);
          setIsReviewDialogOpen(true);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    const interval = setInterval(pollStatus, 3000);
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
