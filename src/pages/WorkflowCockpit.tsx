import { useState, useEffect, useMemo } from 'react';

// Type definitions for component state
interface PhaseCompletionData {
  artifacts?: {
    genre_tropes?: string;
    style_sheet?: string;
    context_bundle?: string;
  };
  result?: string;
  output?: string;
  [key: string]: unknown;
}

interface PhaseInputs {
  genre?: string;
  book_title?: string;
  initial_ideas?: string;
  writing_samples?: string;
  outline_template?: string;
  prohibited_words?: string;
  chapter_number?: number;
  chapter_title?: string;
  [key: string]: string | number | undefined;
}

interface ValidationError {
  loc?: string[];
  msg: string;
  type?: string;
}
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePanelState } from '@/hooks/usePanelState';
import { useCockpitStorage } from '@/hooks/useCockpitStorage';
import { useWorkflowPolling } from '@/hooks/useWorkflowPolling';
import { useToast } from '@/hooks/use-toast';
import { Phase, Artifact } from '@/lib/mockData';
import {
  useProjectProgress,
  useArtifacts,
  useExecutePhase,
  usePendingInputs,
  useProjects,
  useCancelWorkflow,
  useChapters
} from '@/api/hooks';
import type { ChapterDetail } from '@/api/types';
import { apiClient } from '@/api/client';
import { WorkflowReviewDialog } from '@/components/workflow/WorkflowReviewDialog';
import { ArtifactViewDialog } from '@/components/workflow/ArtifactViewDialog';
import { PhaseConfirmDialog } from '@/components/workflow/PhaseConfirmDialog';
import { Phase1InputDialog } from '@/components/workflow/Phase1InputDialog';
import { Phase6InputDialog } from '@/components/workflow/Phase6InputDialog';
import { PhaseCompletionDialog } from '@/components/workflow/PhaseCompletionDialog';
import { PhaseOutputsDialog } from '@/components/workflow/PhaseOutputsDialog';
import { WorkflowPhasesPanel } from '@/components/workflow/WorkflowPhasesPanel';
import { WorkflowContextPanel } from '@/components/workflow/WorkflowContextPanel';
import { WorkflowPhaseHeader } from '@/components/workflow/WorkflowPhaseHeader';
import { WorkflowRecentArtifactsGrid } from '@/components/workflow/WorkflowRecentArtifactsGrid';
import { WorkflowPhaseCard } from '@/components/workflow/WorkflowPhaseCard';
import { AlertCircle, Loader2 } from 'lucide-react';

const PHASE1_INPUTS_KEY_PREFIX = 'novel-weaver:phase1-inputs';

export default function WorkflowCockpit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Get project ID from URL or use first project
  const { data: projects } = useProjects();
  const projectId = searchParams.get('project') || projects?.[0]?.id;

  // Fetch project data
  const { data: progressData, refetch: refetchProgress } = useProjectProgress(projectId);
  const { data: artifactsData } = useArtifacts(projectId);
  const { data: pendingInputs } = usePendingInputs(projectId, { refetchInterval: 5000 });
  const { data: chaptersData } = useChapters(projectId);
  const executePhase = useExecutePhase();
  const cancelWorkflow = useCancelWorkflow();

  const [currentPhase, setCurrentPhase] = useState(1);
  const [isPhasesOpen, togglePhasesOpen] = usePanelState('cockpit-phases', true, projectId);
  const [isContextOpen, toggleContextOpen] = usePanelState('cockpit-context', true, projectId);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [isPhase1InputOpen, setIsPhase1InputOpen] = useState(false);
  const [isPhase6InputOpen, setIsPhase6InputOpen] = useState(false);
  const [phase6FormData, setPhase6FormData] = useState({
    chapter_number: '1',
    chapter_title: ''
  });
  const [isConfirmRunOpen, setIsConfirmRunOpen] = useState(false);
  const [phaseToRun, setPhaseToRun] = useState<number | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [completionData, setCompletionData] = useState<PhaseCompletionData | null>(null);
  const [reviewContent, setReviewContent] = useState<string>('');
  const [reviewDescription, setReviewDescription] = useState<string>('');
  const [reviewExpectedOutputs, setReviewExpectedOutputs] = useState<string[]>([]);
  const [phase1FormData, setPhase1FormData] = useState({
    genre: '',
    book_title: '',
    initial_ideas: '',
    writing_samples: '',
    outline_template: '',
    prohibited_words: ''
  });
  const [runningPhases, setRunningPhases] = useState<Set<number>>(new Set());
  const [phaseInputs, setPhaseInputs] = useState<PhaseInputs>({});
  const [workflowStartTimes, setWorkflowStartTimes] = useState<Record<number, number>>({});
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentWorkflowPhase, setCurrentWorkflowPhase] = useState<number | null>(null);
  const [completionPhase, setCompletionPhase] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'genre_tropes' | 'style_sheet' | 'context_bundle'>('genre_tropes');
  // Typed helper for chapters
  const chaptersList: ChapterDetail[] = useMemo(
    () => (chaptersData || []) as ChapterDetail[],
    [chaptersData]
  );

  // Autofill Phase 6 dialog with the next incomplete chapter from outline
  useEffect(() => {
    if (!isPhase6InputOpen || !chaptersList || chaptersList.length === 0) return;
    // If no title selected yet, pick first not completed chapter
    if (!phase6FormData.chapter_title) {
      const next: ChapterDetail | undefined = chaptersList.find((c) => c.status !== 'completed') || chaptersList[0];
      if (next) {
        setPhase6FormData({ chapter_number: String(next.number), chapter_title: next.title });
      }
    }
  }, [isPhase6InputOpen, chaptersList, phase6FormData.chapter_title]);
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  const [isArtifactViewOpen, setIsArtifactViewOpen] = useState(false);

  // Load saved outputs and phase outputs from localStorage when projectId changes
  const { savedOutputs, setSavedOutputsAndPersist, phaseOutputs, setPhaseOutputsAndPersist } = useCockpitStorage<PhaseCompletionData>(projectId);

  useEffect(() => {
    if (!projectId) return;
    try {
      const raw = localStorage.getItem(`${PHASE1_INPUTS_KEY_PREFIX}:${projectId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setPhase1FormData((prev) => ({ ...prev, ...(parsed as Record<string, string>) }));
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(`${PHASE1_INPUTS_KEY_PREFIX}:${projectId}`, JSON.stringify(phase1FormData));
    } catch {
      // ignore
    }
  }, [projectId, phase1FormData]);

  useEffect(() => {
    if (!projectId) return;
    const meta = projects?.find((p) => p.id === projectId);
    if (!meta) return;
    setPhase1FormData((prev) => {
      const next = { ...prev };
      if (!next.genre && meta.genre) next.genre = meta.genre;
      if (!next.book_title && meta.title) next.book_title = meta.title;
      return next;
    });
  }, [projectId, projects]);

  // Watch for pending inputs and open review dialog
  useEffect(() => {
    if (!pendingInputs || pendingInputs.length === 0) return;

    // Check if there's a pending input for the current running phase
    const currentPending = pendingInputs.find(input => 
      input.phase === currentPhase && input.workflowId === currentWorkflowId
    );

    if (currentPending && !isReviewDialogOpen) {
      console.log('Opening review dialog for pending input:', currentPending);
      
      // Try to parse and format the content nicely
      let formattedContent = currentPending.currentContent || currentPending.prompt || '';
      
      // If content looks like JSON, try to extract the actual content
      try {
        const parsed = JSON.parse(formattedContent);
        // If it's an object with common content fields, extract them
        if (parsed.series_outline) formattedContent = parsed.series_outline;
        else if (parsed.content) formattedContent = parsed.content;
        else if (parsed.result) formattedContent = parsed.result;
        else if (parsed.output) formattedContent = parsed.output;
      } catch (e) {
        // Not JSON, use as-is
      }
      
      setReviewContent(formattedContent);
      setReviewDescription(currentPending.prompt || 'Please review and provide your decision.');
      setReviewExpectedOutputs(currentPending.expectedOutputs || []);
      setIsReviewDialogOpen(true);
    }
  }, [pendingInputs, currentPhase, currentWorkflowId, isReviewDialogOpen]);

  // Convert backend progress data to Phase format
  const phases: Phase[] = progressData?.phases.map(p => {
    const phaseInfo = getPhaseInfo(p.phase);
    const isPhaseRunning = runningPhases.has(p.phase);
    return {
      id: p.phase,
      name: phaseInfo.name,
      description: phaseInfo.description,
      status: p.status === 'completed'
        ? ('completed' as const)
        : isPhaseRunning
          ? ('in-progress' as const)
          : ('not-started' as const),
      duration: phaseInfo.duration,
      outputs: phaseInfo.outputs,
      requiredInputs: phaseInfo.requiredInputs,
    };
  }) || [];

  // Convert artifacts data and merge with saved outputs
  const artifacts: Artifact[] = [
    ...Object.entries(savedOutputs).map(([key, value]) => ({
      id: key,
      name: value.name,
      type: getArtifactType(value.name),
      content: value.content,
      updatedAt: new Date(),
      pinned: true,
    })),
    ...(artifactsData || []).map((a, idx) => ({
      id: `backend:${a.path}`,
      name: a.name,
      type: getArtifactType(a.name),
      content: '',
      updatedAt: new Date(a.modified),
      pinned: false,
    }))
  ];

  const activePhase = phases.find((p) => p.id === currentPhase) || phases[0];
  const isRunning = runningPhases.has(currentPhase);

  const getRequiredInputsStatus = (phase: Phase | undefined) => {
    if (!phase) {
      return { completed: 0, total: 0, missing: [] };
    }

    // Check if the workflow is waiting for user input for this phase
    const hasPendingInput = pendingInputs?.some(input => input.phase === phase.id);

    // If we have pending inputs, it means the workflow is waiting
    // Only mark inputs as complete if the phase is actually completed
    let completed = 0;
    if (phase.status === 'completed') {
      completed = phase.requiredInputs.length;
    } else if (phase.id === 1) {
      // For Phase 1, check if form data has been filled
      if ((phase1FormData.genre || '').trim()) completed++;
      if ((phase1FormData.book_title || '').trim()) completed++;
      if ((phase1FormData.initial_ideas || '').trim()) completed++;
    } else if (phase.status === 'in-progress' && !hasPendingInput) {
      // Phase is running but not waiting for input - inputs must have been provided
      completed = phase.requiredInputs.length;
    } else if (phaseOutputs[phase.id - 1]) {
      // Previous phase has outputs, so inputs are available
      completed = phase.requiredInputs.length;
    }

    return {
      completed,
      total: phase.requiredInputs.length,
      missing: phase.requiredInputs.slice(completed),
    };
  };

  const handleCancelWorkflow = async () => {
    if (!currentWorkflowId) return;

    try {
      await cancelWorkflow.mutateAsync(currentWorkflowId);

      setRunningPhases(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentPhase);
        return newSet;
      });

      setCurrentWorkflowId(null);
      setWorkflowStartTimes(prev => {
        const updated = { ...prev };
        delete updated[currentPhase];
        return updated;
      });

      toast({
        title: 'Workflow cancelled',
        description: 'The workflow has been stopped.',
      });

      await refetchProgress();
    } catch (error: unknown) {
      console.error('Cancel workflow error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel workflow';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const inputsStatus = getRequiredInputsStatus(activePhase);

  useEffect(() => {
    if (!progressData) return;
    setRunningPhases((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const phaseNum of prev) {
        const phaseData = progressData.phases.find((p) => p.phase === phaseNum);
        if (!phaseData) continue;
        if (phaseData.status === 'completed' || phaseData.status === 'failed') {
          next.delete(phaseNum);
        }
      }
      return next;
    });
  }, [progressData]);

  // Elapsed time tracking
  useEffect(() => {
    if (!isRunning) {
      setElapsedTime(0);
      return;
    }

    const startTime = workflowStartTimes[currentPhase];
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, currentPhase, workflowStartTimes]);

  useWorkflowPolling<PhaseCompletionData>({
    projectId,
    phase: currentWorkflowPhase ?? currentPhase,
    workflowId: currentWorkflowId,
    refetchProgress,
    setCompletionData: (data) => {
      setCompletionData(data);
      setCompletionPhase(currentWorkflowPhase ?? currentPhase);
    },
    setIsCompletionDialogOpen,
    setReviewContent,
    setReviewDescription,
    setReviewExpectedOutputs,
    setIsReviewDialogOpen,
    setRunningPhases,
    setWorkflowId: (workflowId) => {
      setCurrentWorkflowId(workflowId);
      if (!workflowId) setCurrentWorkflowPhase(null);
    },
    setPhaseOutputsAndPersist,
  });

  // Show loading state if no project data yet
  if (!projectId || !progressData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Loading project data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Guard against missing active phase
  if (!activePhase) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">No phases found for this project</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Helper function to get phase metadata
  function getPhaseInfo(phaseNum: number) {
    const phaseData: Record<number, { name: string; description: string; duration: string; outputs: string[]; requiredInputs: string[] }> = {
      1: {
        name: 'Initial Setup & Research',
        description: 'Analyze genre tropes and establish your writing style sheet.',
        duration: '5-10 minutes',
        outputs: ['genre_tropes.md', 'style_sheet.md'],
        requiredInputs: ['Genre', 'Book title', 'Initial ideas'],
      },
      2: {
        name: 'Brainstorming & Series Outline',
        description: 'Interactive brainstorming session to develop your series outline.',
        duration: '15-30 minutes',
        outputs: ['series_outline.md'],
        requiredInputs: ['Output from Phase 1'],
      },
      3: {
        name: 'Call Sheet Generation',
        description: 'Generate a comprehensive call sheet for your novel production.',
        duration: '5-10 minutes',
        outputs: ['call_sheet.md'],
        requiredInputs: ['Series outline'],
      },
      4: {
        name: 'Characters & Worldbuilding',
        description: 'Develop deep character profiles and rich world details.',
        duration: '10-20 minutes',
        outputs: ['characters.md', 'worldbuilding.md'],
        requiredInputs: ['Call sheet', 'Genre tropes'],
      },
      5: {
        name: 'Chapter Outline Creation',
        description: 'Create detailed chapter-by-chapter outline for your novel.',
        duration: '10-15 minutes',
        outputs: ['outline.md'],
        requiredInputs: ['Series outline', 'Characters', 'Worldbuilding'],
      },
      6: {
        name: 'Chapter Writing',
        description: 'Write each chapter through the scene brief → draft → improve → final pipeline.',
        duration: '15-25 min/chapter',
        outputs: ['chapter_X_final.md'],
        requiredInputs: ['Outline', 'Characters', 'Style sheet'],
      },
      7: {
        name: 'Final Compilation',
        description: 'Compile all chapters into the final manuscript.',
        duration: '5 minutes',
        outputs: ['FINAL_MANUSCRIPT.md'],
        requiredInputs: ['All chapters finalized'],
      },
    };
    return phaseData[phaseNum] || phaseData[1];
  }

  function getArtifactType(name: string): Artifact['type'] {
    if (name.includes('outline')) return 'outline';
    if (name.includes('character')) return 'characters';
    if (name.includes('world')) return 'worldbuilding';
    if (name.includes('style')) return 'style';
    if (name.includes('chapter')) return 'chapter';
    return 'other';
  }

  // Get actual phase output content from stored data
  const getPhaseOutputContent = () => {
    const storedOutput = phaseOutputs[activePhase.id];
    
    if (!storedOutput) {
      return "No output available yet. Please run this phase to generate outputs.";
    }

    // For Phase 1, combine all artifacts into a readable format
    if (activePhase.id === 1 && storedOutput.artifacts) {
      let content = '';
      if (storedOutput.artifacts.genre_tropes) {
        content += '# Genre Tropes\n\n' + storedOutput.artifacts.genre_tropes + '\n\n';
      }
      if (storedOutput.artifacts.style_sheet) {
        content += '# Style Sheet\n\n' + storedOutput.artifacts.style_sheet + '\n\n';
      }
      if (storedOutput.artifacts.context_bundle) {
        content += '# Context Bundle\n\n' + storedOutput.artifacts.context_bundle;
      }
      return content || JSON.stringify(storedOutput, null, 2);
    }

    // For other phases, prefer known content fields
    const obj = storedOutput as Record<string, unknown>;
    const preferredFields = [
      'outline',
      'chapter_outline',
      'series_outline',
      'call_sheet',
      'character_profiles',
      'characters',
      'worldbuilding',
      'scene_brief',
      'first_draft',
      'improvement_plan',
      'final_chapter',
      'updated_context_bundle',
      'final_manuscript',
      'result',
      'output',
      'content',
    ];
    for (const key of preferredFields) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        return val as string;
      }
    }

    // Fallback to JSON representation
    return JSON.stringify(storedOutput, null, 2);
  };

  const handleViewOutputs = () => {
    setIsOutputModalOpen(true);
  };

  // Show confirmation dialog before running phase
  const handleRunPhaseClick = () => {
    // For Phase 1, show input dialog directly
    if (currentPhase === 1) {
      setIsPhase1InputOpen(true);
    } else if (currentPhase === 6) {
      // For Phase 6, show chapter input dialog
      setIsPhase6InputOpen(true);
    } else {
      // For other phases, show confirmation
      setPhaseToRun(currentPhase);
      setIsConfirmRunOpen(true);
    }
  };

  // Actually execute the workflow after confirmation
  const handleConfirmRunPhase = async () => {
    setIsConfirmRunOpen(false);

    if (!projectId || phaseToRun === null) {
      toast({ title: 'Error', description: 'No project selected', variant: 'destructive' });
      return;
    }

    const phaseNum = phaseToRun;

    try {
      setRunningPhases(prev => new Set(prev).add(phaseNum));
      setWorkflowStartTimes(prev => ({ ...prev, [phaseNum]: Date.now() }));

      const inputs: PhaseInputs = {};

      // For Phase 1, use the form inputs
      if (phaseNum === 1) {
        inputs.genre = phase1FormData.genre || projects?.find(p => p.id === projectId)?.genre || '';
        inputs.book_title = phase1FormData.book_title || projects?.find(p => p.id === projectId)?.title || '';
        inputs.initial_ideas = phase1FormData.initial_ideas;
        inputs.writing_samples = phase1FormData.writing_samples;
        inputs.outline_template = phase1FormData.outline_template;
        inputs.prohibited_words = phase1FormData.prohibited_words;
      }
      // For Phase 6, use chapter inputs
      else if (phaseNum === 6) {
        inputs.chapter_number = parseInt(phase6FormData.chapter_number, 10);
        inputs.chapter_title = phase6FormData.chapter_title;
      }
      // For Phase 2+, check if previous phase has outputs
      else if (phaseNum > 1) {
        const prevPhaseStatus = progressData?.phases?.find((p) => p.phase === phaseNum - 1)?.status;
        const prevPhaseOutput = phaseOutputs[phaseNum - 1];
        const prevCompleted = prevPhaseStatus === 'completed';
        if (!prevCompleted && !prevPhaseOutput) {
          toast({
            title: 'Missing Prerequisites',
            description: `Phase ${phaseNum - 1} must be completed before running Phase ${phaseNum}.`,
            variant: 'destructive',
          });
          setRunningPhases(prev => {
            const newSet = new Set(prev);
            newSet.delete(phaseNum);
            return newSet;
          });
          return;
        }
        // Phase 2 and beyond may need outputs from previous phases
        // The backend should handle pulling from artifacts/database
      }

      console.log('Executing phase:', { projectId, phase: phaseNum, inputs });

      const result = await executePhase.mutateAsync({
        projectId,
        phase: phaseNum,
        request: {
          phase: phaseNum,
          inputs
        },
      });

      setCurrentWorkflowId(result.workflowId);
      setCurrentWorkflowPhase(phaseNum);
      setCompletionPhase(null);

      console.log('Phase execution result:', result);

      const phaseName = getPhaseInfo(phaseNum).name;

      toast({
        title: 'Phase started',
        description: `Phase ${phaseNum}: ${phaseName} is now running.`,
      });

      // Start polling for status
      const pollInterval = setInterval(async () => {
        const updated = await refetchProgress();
        const phaseData = updated.data?.phases.find(p => p.phase === phaseNum);

        if (phaseData?.status === 'completed' || phaseData?.status === 'failed') {
          clearInterval(pollInterval);
          setRunningPhases(prev => {
            const newSet = new Set(prev);
            newSet.delete(phaseNum);
            return newSet;
          });

          // Refresh progress one more time to ensure UI is in sync
          setTimeout(() => refetchProgress(), 500);

          if (phaseData.status === 'completed') {
            toast({
              title: 'Phase completed',
              description: `Phase ${phaseNum}: ${phaseName} has finished successfully.`,
            });
          } else {
            toast({
              title: 'Phase failed',
              description: `Phase ${phaseNum} encountered an error.`,
              variant: 'destructive',
            });
          }
        }
      }, 3000);

    } catch (error: unknown) {
      setRunningPhases(prev => {
        const newSet = new Set(prev);
        newSet.delete(phaseNum);
        return newSet;
      });

      console.error('Phase execution error:', error);

      // Get detailed error message
      let errorMessage = 'Failed to start phase';
      let errorDetails = '';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const responseError = error as { response?: { data?: { detail?: unknown; message?: string } } };
        const detail = responseError.response?.data?.detail;
        const message = responseError.response?.data?.message;
        
        if (Array.isArray(detail)) {
          errorMessage = detail.map((e: ValidationError) =>
            `${e.loc?.join('.') || 'field'}: ${e.msg}`
          ).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (message) {
          errorMessage = message;
        }
        
        // Add full error details for backend debugging
        errorDetails = JSON.stringify(responseError.response?.data, null, 2);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Show error with details
      toast({
        title: '❌ Phase Execution Failed',
        description: errorDetails ? `${errorMessage}\n\nBackend Error Details:\n${errorDetails}\n\nCheck your server logs for more information.` : `${errorMessage}\n\nThis is a backend error. Check your server logs for more details.`,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  const handleSubmitReview = async (inputs: Record<string, string>) => {
    if (!currentWorkflowId) return;

    try {
      await apiClient.respondToWorkflow(currentWorkflowId, {
        inputs,
      });

      setIsReviewDialogOpen(false);
      toast({
        title: 'Response submitted',
        description: 'Workflow will continue.',
      });

      // Refetch to update UI
      await refetchProgress();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit response';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handlePhase1InputSubmit = async () => {
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'No project selected',
        variant: 'destructive',
      });
      return;
    }

    // Validate required field
    if (!phase1FormData.initial_ideas) {
      toast({
        title: 'Error',
        description: 'Please provide your initial ideas',
        variant: 'destructive',
      });
      return;
    }

    // Close input dialog and show confirmation
    setIsPhase1InputOpen(false);
    setPhaseToRun(1);
    setIsConfirmRunOpen(true);
  };

  const handlePhase6InputSubmit = async () => {
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'No project selected',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields
    if (!phase6FormData.chapter_title) {
      toast({
        title: 'Error',
        description: 'Please provide a chapter title',
        variant: 'destructive',
      });
      return;
    }

    // Close input dialog and show confirmation
    setIsPhase6InputOpen(false);
    setPhaseToRun(6);
    setIsConfirmRunOpen(true);
  };

  const handleEditInEditor = () => {
    if (activePhase.id === 6) {
      // Ensure Chapter Studio knows which project to load
      if (projectId) {
        navigate(`/chapter-studio?projectId=${projectId}`);
      } else {
        navigate('/chapter-studio');
      }
    } else if (activePhase.id === 7) {
      navigate('/compile');
    } else {
      if (projectId) {
        navigate(`/phase-editor/${activePhase.id}?projectId=${projectId}`);
      } else {
        navigate(`/phase-editor/${activePhase.id}`);
      }
    }
  };

  const savedArtifacts = artifacts.filter(a => a.pinned);

  const handleSaveOutput = (outputKey: string, outputName: string, content: string) => {
    setSavedOutputsAndPersist(prev => {
      const updated = {
        ...prev,
        [outputKey]: { content, name: outputName, type: outputKey }
      };
      // Persist to localStorage
      return updated;
    });
    toast({
      title: 'Output saved',
      description: `${outputName} has been saved to context panel.`,
    });
  };

  const handleUnsaveOutput = (outputKey: string) => {
    setSavedOutputsAndPersist(prev => {
      const updated = { ...prev };
      delete updated[outputKey];
      // Persist to localStorage
      return updated;
    });
    toast({
      title: 'Output removed',
      description: 'The artifact has been removed from context panel.',
    });
  };

  const handleToggleSave = async (artifact: Artifact) => {
    if (artifact.pinned) {
      handleUnsaveOutput(artifact.id);
      return;
    }

    if (projectId && (!artifact.content || artifact.content.trim().length === 0) && artifact.id.startsWith('backend:')) {
      try {
        const artifactPath = artifact.id.slice('backend:'.length);
        const res = await apiClient.getArtifact(projectId, artifactPath);
        handleSaveOutput(artifact.id, artifact.name, res.content);
        return;
      } catch (e) {
        console.warn('Could not fetch artifact content before saving:', e);
      }
    }

    handleSaveOutput(artifact.id, artifact.name, artifact.content);
  };

  const handleViewArtifact = async (artifact: Artifact) => {
    if (projectId && (!artifact.content || artifact.content.trim().length === 0) && artifact.id.startsWith('backend:')) {
      try {
        const artifactPath = artifact.id.slice('backend:'.length);
        const res = await apiClient.getArtifact(projectId, artifactPath);
        const withContent: Artifact = { ...artifact, content: res.content };
        setViewingArtifact(withContent);
        setIsArtifactViewOpen(true);
        return;
      } catch (e) {
        console.warn('Could not fetch artifact content:', e);
      }
    }

    setViewingArtifact(artifact);
    setIsArtifactViewOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left sidebar - Phases */}
        <WorkflowPhasesPanel
          isOpen={isPhasesOpen}
          onToggle={togglePhasesOpen}
          projectTitle={projects?.find(p => p.id === projectId)?.title || 'My Novel'}
          projectGenre={projects?.find(p => p.id === projectId)?.genre || 'Fiction'}
          totalChapters={progressData?.totalChapters || 0}
          phases={phases}
          currentPhase={currentPhase}
          onPhaseClick={(phaseId) => setCurrentPhase(phaseId)}
        />

        {/* Main content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 min-h-0 overflow-y-auto">
          {/* Current phase header */}
          <WorkflowPhaseHeader phaseId={activePhase.id} phaseName={activePhase.name} description={activePhase.description} />

          {/* Phase card */}
          <WorkflowPhaseCard
            activePhase={activePhase}
            inputsStatus={inputsStatus}
            isRunning={isRunning}
            elapsedTime={elapsedTime}
            currentPhaseProgress={progressData?.phases.find(p => p.phase === currentPhase)?.progress}
            hasProject={Boolean(projectId)}
            canViewOutputs={Boolean(phaseOutputs[activePhase.id]) || activePhase.status !== 'not-started'}
            canEditOutputs={Boolean(phaseOutputs[activePhase.id]) || activePhase.status !== 'not-started'}
            canRerun={activePhase.status === 'completed' && !isRunning}
            cancelPending={cancelWorkflow.isPending}
            showOpenChapterStudio={activePhase.id === 6}
            onOpenChapterStudio={() => {
              if (projectId) {
                navigate(`/chapter-studio?projectId=${projectId}`);
              } else {
                navigate('/chapter-studio');
              }
            }}
            onCancelWorkflow={handleCancelWorkflow}
            onRunPhase={handleRunPhaseClick}
            onViewOutputs={handleViewOutputs}
            onEditInEditor={handleEditInEditor}
          />

          {/* Recent artifacts */}
          <WorkflowRecentArtifactsGrid
            artifacts={artifacts}
            onOpenArtifact={(artifact) => {
              void handleViewArtifact(artifact);
            }}
            onTogglePin={(artifact) => {
              void handleToggleSave(artifact);
            }}
          />
        </div>

        {/* Context Panel */}
        <WorkflowContextPanel
          isOpen={isContextOpen}
          onToggle={toggleContextOpen}
          savedArtifacts={savedArtifacts}
          artifacts={artifacts}
          onOpenArtifact={(artifact) => {
            void handleViewArtifact(artifact);
          }}
          onTogglePin={(artifact) => {
            void handleToggleSave(artifact);
          }}
        />
      </div>

      {/* Confirmation Dialog */}
      <PhaseConfirmDialog
        open={isConfirmRunOpen}
        onOpenChange={setIsConfirmRunOpen}
        phaseToRun={phaseToRun}
        phaseDescription={phaseToRun ? getPhaseInfo(phaseToRun).description : ''}
        phaseDuration={phaseToRun ? getPhaseInfo(phaseToRun).duration : ''}
        showPhase1Hint={phaseToRun === 1}
        onCancel={() => setIsConfirmRunOpen(false)}
        onConfirm={handleConfirmRunPhase}
      />

      {/* Output Modal */}
      <PhaseOutputsDialog
        open={isOutputModalOpen}
        onOpenChange={setIsOutputModalOpen}
        phaseId={activePhase.id}
        phaseName={activePhase.name}
        content={getPhaseOutputContent()}
        onClose={() => setIsOutputModalOpen(false)}
        onEdit={handleEditInEditor}
      />

      {/* Phase 1 Input Dialog */}
      <Phase1InputDialog
        open={isPhase1InputOpen}
        onOpenChange={setIsPhase1InputOpen}
        formData={phase1FormData}
        onFormDataChange={setPhase1FormData}
        genrePlaceholder={projects?.find(p => p.id === projectId)?.genre || 'e.g., Fantasy, Sci-Fi, Romance...'}
        bookTitlePlaceholder={projects?.find(p => p.id === projectId)?.title || 'Enter your book title'}
        onCancel={() => setIsPhase1InputOpen(false)}
        onSubmit={handlePhase1InputSubmit}
      />

      {/* Phase 6 Input Dialog */}
      <Phase6InputDialog
        open={isPhase6InputOpen}
        onOpenChange={setIsPhase6InputOpen}
        formData={phase6FormData}
        onFormDataChange={setPhase6FormData}
        chapters={chaptersList}
        showChapterSelector={Boolean(chaptersData && chaptersData.length > 0)}
        onCancel={() => setIsPhase6InputOpen(false)}
        onSubmit={handlePhase6InputSubmit}
      />

      {/* Review Dialog */}
      <WorkflowReviewDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        content={reviewContent}
        description={reviewDescription}
        expectedOutputs={reviewExpectedOutputs}
        onSubmit={handleSubmitReview}
      />

      {/* Completion Dialog */}
      <PhaseCompletionDialog
        open={isCompletionDialogOpen}
        onOpenChange={setIsCompletionDialogOpen}
        currentPhase={completionPhase ?? currentPhase}
        completionData={completionData}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSavePhase1ActiveTab={() => {
          if (!completionData?.artifacts) return;
          if (activeTab === 'genre_tropes' && completionData.artifacts.genre_tropes) {
            handleSaveOutput('genre_tropes', 'Genre Tropes', completionData.artifacts.genre_tropes);
          } else if (activeTab === 'style_sheet' && completionData.artifacts.style_sheet) {
            handleSaveOutput('style_sheet', 'Style Sheet', completionData.artifacts.style_sheet);
          } else if (activeTab === 'context_bundle' && completionData.artifacts.context_bundle) {
            handleSaveOutput('context_bundle', 'Context Bundle', completionData.artifacts.context_bundle);
          }
        }}
        onSavePhase1All={() => {
          if (!completionData?.artifacts) return;
          if (completionData.artifacts.genre_tropes) handleSaveOutput('genre_tropes', 'Genre Tropes', completionData.artifacts.genre_tropes);
          if (completionData.artifacts.style_sheet) handleSaveOutput('style_sheet', 'Style Sheet', completionData.artifacts.style_sheet);
          if (completionData.artifacts.context_bundle) handleSaveOutput('context_bundle', 'Context Bundle', completionData.artifacts.context_bundle);
          toast({ title: 'All outputs saved', description: 'All Phase 1 artifacts have been saved to context.' });
        }}
        onSaveOutput={handleSaveOutput}
        onClose={() => setIsCompletionDialogOpen(false)}
        onContinue={() => {
          setIsCompletionDialogOpen(false);
          const nextPhase = currentPhase + 1;
          setCurrentPhase(nextPhase);
          if (currentPhase === 1) {
            toast({
              title: 'Moving to Phase 2',
              description: 'Ready to start brainstorming your series outline.',
            });
            setTimeout(() => {
              setPhaseToRun(2);
              setIsConfirmRunOpen(true);
            }, 1000);
          }
        }}
        onOpenChapterStudio={() => {
          setIsCompletionDialogOpen(false);
          if (projectId) {
            navigate(`/chapter-studio?projectId=${projectId}`);
            toast({
              title: 'Opening Chapter Studio',
              description: 'Start writing your chapters in the Chapter Studio.',
            });
          }
        }}
      />

      {/* Artifact Viewing Dialog */}
      <ArtifactViewDialog
        open={isArtifactViewOpen}
        onOpenChange={setIsArtifactViewOpen}
        artifact={viewingArtifact}
        onTogglePin={() => {
          if (viewingArtifact) {
            void handleToggleSave(viewingArtifact);
          }
        }}
        onCopy={() => {
          if (viewingArtifact?.content) {
            navigator.clipboard.writeText(viewingArtifact.content);
            toast({
              title: 'Copied to clipboard',
              description: 'Artifact content has been copied.',
            });
          }
        }}
      />
    </AppLayout >
  );
}
