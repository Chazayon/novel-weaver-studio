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
import { PhaseTimeline } from '@/components/shared/PhaseTimeline';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePanelState } from '@/hooks/usePanelState';
import { useToast } from '@/hooks/use-toast';
import { Phase, Artifact } from '@/lib/mockData';
import {
  useProjectProgress,
  useArtifacts,
  useExecutePhase,
  usePhaseStatus,
  usePendingInputs,
  useProjects,
  useCancelWorkflow,
  useChapters
} from '@/api/hooks';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { ChapterDetail } from '@/api/types';
import { apiClient } from '@/api/client';
import {
  Play,
  Eye,
  Edit,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileText,
  Layers,
  Pin, // Using Pin icon but labeling as 'Save'
  Loader2,
  XCircle,
  Copy
} from 'lucide-react';

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
  const [isPhasesOpen, togglePhasesOpen] = usePanelState('cockpit-phases', true);
  const [isContextOpen, toggleContextOpen] = usePanelState('cockpit-context', true);
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'genre_tropes' | 'style_sheet' | 'context_bundle'>('genre_tropes');
  const [savedOutputs, setSavedOutputs] = useState<Record<string, { content: string; name: string; type: string }>>({});
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
  const [phaseOutputs, setPhaseOutputs] = useState<Record<number, PhaseCompletionData>>({});
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  const [isArtifactViewOpen, setIsArtifactViewOpen] = useState(false);

  // Load saved outputs and phase outputs from localStorage when projectId changes
  useEffect(() => {
    if (!projectId) return;

    try {
      const storedSaved = localStorage.getItem(`novel-weaver-saved-${projectId}`);
      if (storedSaved) {
        setSavedOutputs(JSON.parse(storedSaved));
      }

      const storedOutputs = localStorage.getItem(`novel-weaver-outputs-${projectId}`);
      if (storedOutputs) {
        setPhaseOutputs(JSON.parse(storedOutputs));
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }, [projectId]);

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
      setIsReviewDialogOpen(true);
    }
  }, [pendingInputs, currentPhase, currentWorkflowId, isReviewDialogOpen]);

  // Convert backend progress data to Phase format
  const phases: Phase[] = progressData?.phases.map(p => {
    const phaseInfo = getPhaseInfo(p.phase);
    return {
      id: p.phase,
      name: phaseInfo.name,
      description: phaseInfo.description,
      status: p.status === 'completed' ? 'completed' as const :
        p.status === 'in-progress' ? 'in-progress' as const :
          'not-started' as const,
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
      if (phase1FormData.genre) completed++;
      if (phase1FormData.book_title) completed++;
      if (phase1FormData.initial_ideas) completed++;
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

  // Poll for status when workflow is running
  useEffect(() => {
    if (!currentWorkflowId || !projectId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/projects/${projectId}/phases/${currentPhase}/status?workflow_id=${currentWorkflowId}`);
        const statusData = await response.json();

        // Check if workflow completed
        if (statusData.status === 'completed') {
          let outputs = statusData.outputs;
          console.log('=== PHASE COMPLETION DATA ===');
          console.log('Phase:', currentPhase);
          console.log('Raw outputs:', JSON.stringify(outputs, null, 2));
          // For Phase 5, also fetch the saved outline artifact to ensure we have the Markdown
          if (currentPhase === 5 && projectId) {
            try {
              const outline = await apiClient.getArtifact(projectId, 'phase5_outputs/outline.md');
              outputs = { ...outputs, outline: outline.content };
            } catch (e) {
              console.warn('Could not fetch outline artifact:', e);
            }
          }
          setCompletionData(outputs);
          setIsCompletionDialogOpen(true);

          // Store outputs for this phase
          setPhaseOutputs(prev => {
            const updated = { ...prev, [currentPhase]: outputs };
            try {
              localStorage.setItem(`novel-weaver-outputs-${projectId}`, JSON.stringify(updated));
            } catch (error) {
              console.error('Failed to persist phase outputs:', error);
            }
            return updated;
          });

          // Clear running state
          setRunningPhases(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentPhase);
            return newSet;
          });
          setCurrentWorkflowId(null);
          
          // Force multiple refetches to ensure status updates
          await refetchProgress();
          setTimeout(() => refetchProgress(), 500);
          setTimeout(() => refetchProgress(), 1500);
          return; // Stop polling
        }

        // Check if there's a pending review in outputs
        if (statusData.outputs?.pending_review) {
          setReviewContent(statusData.outputs.pending_review.content || '');
          setReviewDescription(statusData.outputs.pending_review.description || '');
          setIsReviewDialogOpen(true);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    // Poll every 3 seconds when workflow is running
    const interval = setInterval(pollStatus, 3000);
    pollStatus(); // Check immediately

    return () => clearInterval(interval);
  }, [currentWorkflowId, projectId, currentPhase, refetchProgress]);

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
        const prevPhaseOutput = phaseOutputs[phaseNum - 1];
        if (!prevPhaseOutput) {
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

  // Handle review approval/rejection
  const handleApproveReview = async () => {
    if (!currentWorkflowId) return;

    try {
      // Respond with APPROVE decision
      await apiClient.respondToWorkflow(currentWorkflowId, {
        inputs: { decision: 'APPROVE' }
      });

      setIsReviewDialogOpen(false);
      toast({
        title: 'Review approved',
        description: 'Workflow will continue with approved content.',
      });

      // Refetch to update UI
      await refetchProgress();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve review';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRejectReview = async () => {
    if (!currentWorkflowId) return;

    // Get revision notes from user
    const revisionNotes = prompt('Please provide revision notes (what needs to be changed):');
    if (!revisionNotes) return; // User cancelled

    try {
      // First, respond with REVISE decision
      await apiClient.respondToWorkflow(currentWorkflowId, {
        inputs: { decision: 'REVISE' }
      });

      // Wait a moment for the workflow to process and request revision notes
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Then provide the revision notes
      await apiClient.respondToWorkflow(currentWorkflowId, {
        inputs: { revision_notes: revisionNotes }
      });

      setIsReviewDialogOpen(false);
      toast({
        title: 'Revision requested',
        description: 'Workflow will revise the content based on your notes.',
      });

      // Refetch to update UI
      await refetchProgress();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request revision';
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
      navigate(`/phase-editor/${activePhase.id}`);
    }
  };

  const savedArtifacts = artifacts.filter(a => a.pinned);

  const handleSaveOutput = (outputKey: string, outputName: string, content: string) => {
    setSavedOutputs(prev => {
      const updated = {
        ...prev,
        [outputKey]: { content, name: outputName, type: outputKey }
      };
      // Persist to localStorage
      try {
        localStorage.setItem(`novel-weaver-saved-${projectId}`, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to persist saved outputs:', error);
      }
      return updated;
    });
    toast({
      title: 'Output saved',
      description: `${outputName} has been saved to context panel.`,
    });
  };

  const handleUnsaveOutput = (outputKey: string) => {
    setSavedOutputs(prev => {
      const updated = { ...prev };
      delete updated[outputKey];
      // Persist to localStorage
      try {
        localStorage.setItem(`novel-weaver-saved-${projectId}`, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to persist saved outputs:', error);
      }
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
        <CollapsiblePanel
          title="Phases"
          icon={<Layers className="w-4 h-4" />}
          isOpen={isPhasesOpen}
          onToggle={togglePhasesOpen}
          side="left"
        >
          <div className="p-4">
            <div className="mb-6">
              <h2 className="font-display text-base lg:text-lg font-semibold mb-1">
                {projects?.find(p => p.id === projectId)?.title || 'My Novel'}
              </h2>
              <p className="text-xs lg:text-sm text-muted-foreground">
                {projects?.find(p => p.id === projectId)?.genre || 'Fiction'} • {progressData?.totalChapters || 0} chapters
              </p>
            </div>

            <div className="mb-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workflow Phases
              </span>
            </div>

            <PhaseTimeline
              phases={phases}
              currentPhase={currentPhase}
              onPhaseClick={(phase) => setCurrentPhase(phase.id)}
            />
          </div>
        </CollapsiblePanel>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 min-h-0 overflow-y-auto">
          {/* Current phase header */}
          <div className="mb-6 lg:mb-8">
            <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground mb-2">
              <span>Phase {activePhase.id}</span>
              <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="text-foreground">{activePhase.name}</span>
            </div>
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold gradient-text mb-2">
              {activePhase.name}
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground max-w-2xl">
              {activePhase.description}
            </p>
          </div>

          {/* Phase card */}
          <div className="glass-card p-4 lg:p-6 mb-6 lg:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <Badge variant={
                  activePhase.status === 'completed' ? 'success' :
                    activePhase.status === 'in-progress' ? 'info' : 'muted'
                }>
                  {activePhase.status === 'completed' ? 'Completed' :
                    activePhase.status === 'in-progress' ? 'In Progress' : 'Not Started'}
                </Badge>
                <p className="text-xs lg:text-sm text-muted-foreground mt-2">
                  Estimated duration: {activePhase.duration}
                </p>
              </div>

              {activePhase.id === 6 && (
                <Button
                  onClick={() => {
                    if (projectId) {
                      navigate(`/chapter-studio?projectId=${projectId}`);
                    } else {
                      navigate('/chapter-studio');
                    }
                  }}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4" />
                  Open Chapter Studio
                </Button>
              )}
            </div>

            {/* Live Progress Display */}
            {isRunning && progressData && (
              <div className="mb-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <h4 className="text-sm font-medium">Workflow Running</h4>
                    </div>

                    {/* Time tracking */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span>Elapsed: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s</span>
                      <span>•</span>
                      <span>Est. total: {activePhase.duration}</span>
                    </div>

                    {progressData.phases.find(p => p.phase === currentPhase)?.progress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-muted-foreground">
                            Progress: {Math.round(progressData.phases.find(p => p.phase === currentPhase)?.progress || 0)}%
                          </p>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressData.phases.find(p => p.phase === currentPhase)?.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cancel button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelWorkflow}
                    disabled={cancelWorkflow.isPending}
                    className="ml-4"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground italic">
                  Note: Workflows can take 5-10 minutes. The workflow will continue running even if you navigate away.
                </p>
              </div>
            )}

            {/* Required inputs */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                Required Inputs
                <span className="text-xs text-muted-foreground">
                  ({inputsStatus.completed}/{inputsStatus.total} ready)
                </span>
              </h3>
              <div className="space-y-2">
                {activePhase.requiredInputs.map((input, index) => {
                  const isReady = index < inputsStatus.completed;
                  return (
                    <div
                      key={input}
                      className="flex items-center gap-3 p-2 lg:p-3 rounded-lg bg-muted/30"
                    >
                      {isReady ? (
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
                      )}
                      <span className={`text - sm ${isReady ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {input}
                      </span>
                      {!isReady && (
                        <Badge variant="warning" className="ml-auto text-xs">
                          Missing
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expected outputs */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Expected Outputs</h3>
              <div className="flex flex-wrap gap-2">
                {activePhase.outputs.map((output) => (
                  <Badge key={output} variant="outline" className="text-xs">
                    {output}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 lg:gap-3 pt-4 border-t border-border">
              <Button
                size="default"
                disabled={activePhase.status === 'completed' || isRunning || !projectId}
                onClick={handleRunPhaseClick}
                className="min-w-[120px] lg:min-w-[140px]"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isRunning ? 'Running...' : activePhase.status === 'in-progress' ? 'Continue Phase' : 'Run Phase'}
                </span>
                <span className="sm:hidden">
                  {isRunning ? '...' : 'Run'}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!phaseOutputs[activePhase.id] && activePhase.status === 'not-started'}
                onClick={handleViewOutputs}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden md:inline">View Outputs</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!phaseOutputs[activePhase.id] && activePhase.status === 'not-started'}
                onClick={handleEditInEditor}
              >
                <Edit className="w-4 h-4" />
                <span className="hidden md:inline">Edit in Editor</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={activePhase.status !== 'completed' || isRunning}
                onClick={handleRunPhaseClick}
              >
                <RefreshCw className={`w - 4 h - 4 ${isRunning ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Re-run</span>
              </Button>
            </div>
          </div>

          {/* Recent artifacts */}
          <div>
            <h3 className="text-base lg:text-lg font-display font-semibold mb-4">Recent Artifacts</h3>
            <div className="grid gap-3 lg:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {artifacts.slice(0, 3).map((artifact, index) => (
                <div
                  key={artifact.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ArtifactCard 
                    artifact={artifact}
                    onOpen={() => {
                      void handleViewArtifact(artifact);
                    }}
                    onTogglePin={() => {
                      void handleToggleSave(artifact);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Context Panel */}
        <CollapsiblePanel
          title="Context"
          icon={<Pin className="w-4 h-4" />}
          isOpen={isContextOpen}
          onToggle={toggleContextOpen}
          side="right"
        >
          <div className="p-4 space-y-6">
            {/* Saved artifacts */}
            {savedArtifacts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Saved
                  </span>
                </div>
                <div className="space-y-2">
                  {savedArtifacts.map((artifact) => (
                    <ArtifactCard 
                      key={artifact.id} 
                      artifact={artifact} 
                      compact
                      onOpen={() => {
                        void handleViewArtifact(artifact);
                      }}
                      onTogglePin={() => {
                        void handleToggleSave(artifact);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All artifacts */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                All Artifacts
              </span>
              <div className="space-y-2 mt-3">
                {artifacts.filter(a => !a.pinned).map((artifact) => (
                  <ArtifactCard 
                    key={artifact.id} 
                    artifact={artifact} 
                    compact
                    onOpen={() => {
                      void handleViewArtifact(artifact);
                    }}
                    onTogglePin={() => {
                      void handleToggleSave(artifact);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmRunOpen} onOpenChange={setIsConfirmRunOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Start Phase {phaseToRun}?
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {phaseToRun && getPhaseInfo(phaseToRun).description}
            </p>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">This will:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Start the automated workflow</li>
                <li>• Estimated time: {phaseToRun && getPhaseInfo(phaseToRun).duration}</li>
                {phaseToRun === 1 && <li>• Request your input for genre, title, and ideas</li>}
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
            <Button
              variant="outline"
              onClick={() => setIsConfirmRunOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmRunPhase}>
              Start Workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Output Modal */}
      <Dialog open={isOutputModalOpen} onOpenChange={setIsOutputModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Phase {activePhase.id} Outputs: {activePhase.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                {getPhaseOutputContent()}
              </pre>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsOutputModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleEditInEditor}>
              <Edit className="w-4 h-4" />
              Edit in Editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase 1 Input Dialog */}
      <Dialog open={isPhase1InputOpen} onOpenChange={setIsPhase1InputOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Phase 1: Initial Setup
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Provide the initial details for your novel. The workflow will use this information to research genre tropes and establish your writing style.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="genre">Genre *</Label>
              <Input
                id="genre"
                placeholder={projects?.find(p => p.id === projectId)?.genre || "e.g., Fantasy, Sci-Fi, Romance..."}
                value={phase1FormData.genre}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, genre: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="book_title">Book Title *</Label>
              <Input
                id="book_title"
                placeholder={projects?.find(p => p.id === projectId)?.title || "Enter your book title"}
                value={phase1FormData.book_title}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, book_title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial_ideas">Initial Ideas *</Label>
              <Textarea
                id="initial_ideas"
                placeholder="Describe your story concept, themes, or any initial ideas you have..."
                value={phase1FormData.initial_ideas}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, initial_ideas: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="writing_samples">Writing Samples (Optional)</Label>
              <Textarea
                id="writing_samples"
                placeholder="Paste a sample of your writing to help establish your style..."
                value={phase1FormData.writing_samples}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, writing_samples: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outline_template">Outline Template Preference (Optional)</Label>
              <Input
                id="outline_template"
                placeholder="e.g., Three-act structure, Hero's Journey, Save the Cat..."
                value={phase1FormData.outline_template}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, outline_template: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prohibited_words">Prohibited Words (Optional)</Label>
              <Input
                id="prohibited_words"
                placeholder="Comma-separated list of words to avoid..."
                value={phase1FormData.prohibited_words}
                onChange={(e) => setPhase1FormData({ ...phase1FormData, prohibited_words: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button
              variant="outline"
              onClick={() => setIsPhase1InputOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePhase1InputSubmit}
              disabled={!phase1FormData.initial_ideas}
            >
              Submit Inputs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase 6 Input Dialog */}
      <Dialog open={isPhase6InputOpen} onOpenChange={setIsPhase6InputOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Phase 6: Chapter Writing</DialogTitle>
            <DialogDescription>
              Provide the chapter details to generate scene brief, draft, and final version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Chapter selector from parsed outline */}
            {chaptersData && chaptersData.length > 0 && (
              <div className="space-y-2">
                <Label>Choose Chapter</Label>
                <Select
                  value={phase6FormData.chapter_number}
                  onValueChange={(val) => {
                    const num = Number(val);
                    const ch = chaptersList.find((c: ChapterDetail) => c.number === num);
                    setPhase6FormData({
                      chapter_number: String(val),
                      chapter_title: ch?.title || '',
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {chaptersList.map((c: ChapterDetail) => (
                      <SelectItem key={c.number} value={String(c.number)}>
                        Chapter {c.number}: {c.title} {c.status === 'completed' ? '✅' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {chaptersList.filter((c: ChapterDetail) => c.status === 'completed').length}/{chaptersList.length} completed
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="chapter_number">Chapter Number *</Label>
              <Input
                id="chapter_number"
                type="number"
                min="1"
                placeholder="Enter chapter number (e.g., 1)"
                value={phase6FormData.chapter_number}
                onChange={(e) => setPhase6FormData({ ...phase6FormData, chapter_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chapter_title">Chapter Title *</Label>
              <Input
                id="chapter_title"
                placeholder="Enter the chapter title"
                value={phase6FormData.chapter_title}
                onChange={(e) => setPhase6FormData({ ...phase6FormData, chapter_title: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button
              variant="outline"
              onClick={() => setIsPhase6InputOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePhase6InputSubmit}
              disabled={!phase6FormData.chapter_title}
            >
              Submit Inputs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Workflow Output</DialogTitle>
            <DialogDescription>
              {reviewDescription || 'Please review the generated content and approve or request revisions.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none p-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{reviewContent}</pre>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRejectReview}
            >
              Request Revisions
            </Button>
            <Button
              onClick={handleApproveReview}
            >
              Approve & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Phase {currentPhase} Completed! 🎉
            </DialogTitle>
            <DialogDescription>
              {currentPhase === 1
                ? "Your novel foundation has been created. Review the outputs below."
                : "The workflow has successfully finished. Here are the generated results."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              {currentPhase === 1 && completionData?.artifacts ? (
                /* Phase 1: Tabbed artifacts */
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex border-b border-border bg-muted/30">
                    <button
                      onClick={() => setActiveTab('genre_tropes')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'genre_tropes' ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      Genre Tropes
                    </button>
                    <button
                      onClick={() => setActiveTab('style_sheet')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'style_sheet' ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      Style Sheet
                    </button>
                    <button
                      onClick={() => setActiveTab('context_bundle')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'context_bundle' ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      Context Bundle
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                        {activeTab === 'genre_tropes' && (completionData.artifacts.genre_tropes || 'No content available')}
                        {activeTab === 'style_sheet' && (completionData.artifacts.style_sheet || 'No content available')}
                        {activeTab === 'context_bundle' && (completionData.artifacts.context_bundle || 'No content available')}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                /* Other phases: Parse and show outputs */
                <div className="p-4 space-y-4">
                  {(() => {
                    // Try to parse completion data if it's a string
                    let parsedData = completionData;
                    console.log('Completion dialog - raw data:', completionData);
                    if (typeof completionData === 'string') {
                      try {
                        parsedData = JSON.parse(completionData);
                        console.log('Parsed from string:', parsedData);
                      } catch (e) {
                        parsedData = { content: completionData };
                      }
                    }

                    // Extract the actual content from various possible fields
                    const extractContent = (data: unknown): { title: string; content: string } | null => {
                      if (!data || typeof data !== 'object') return null;
                      const obj = data as Record<string, unknown>;
                      
                      // Phase 2: series_outline
                      if (typeof obj.series_outline === 'string') return { title: 'Series Outline', content: obj.series_outline };
                      // Phase 3: call_sheet
                      if (typeof obj.call_sheet === 'string') return { title: 'Call Sheet', content: obj.call_sheet };
                      // Phase 4: character_profiles or worldbuilding
                      if (typeof obj.character_profiles === 'string') return { title: 'Character Profiles', content: obj.character_profiles };
                      if (typeof obj.characters === 'string') return { title: 'Character Profiles', content: obj.characters };
                      if (typeof obj.worldbuilding === 'string') return { title: 'Worldbuilding', content: obj.worldbuilding };
                      // Phase 5: outline (from Phase5Output)
                      if (typeof obj.outline === 'string') return { title: 'Chapter Outline', content: obj.outline };
                      if (typeof obj.chapter_outline === 'string') return { title: 'Chapter Outline', content: obj.chapter_outline };
                      // Phase 6: final chapter
                      if (typeof obj.final_chapter === 'string') return { title: 'Final Chapter', content: obj.final_chapter };
                      // Phase 7: manuscript
                      if (typeof obj.final_manuscript === 'string') return { title: 'Final Manuscript', content: obj.final_manuscript };
                      // Generic fields
                      if (typeof obj.result === 'string') return { title: 'Result', content: obj.result };
                      if (typeof obj.output === 'string') return { title: 'Output', content: obj.output };
                      if (typeof obj.content === 'string') return { title: 'Content', content: obj.content };
                      return null;
                    };

                    if (parsedData && typeof parsedData === 'object') {
                      const obj = parsedData as Record<string, unknown>;

                      if (currentPhase === 4) {
                        const sections = [
                          { title: 'Character Profiles', content: typeof obj.character_profiles === 'string' ? obj.character_profiles : (typeof obj.characters === 'string' ? obj.characters : '') },
                          { title: 'Worldbuilding', content: typeof obj.worldbuilding === 'string' ? obj.worldbuilding : '' },
                        ].filter((s) => typeof s.content === 'string' && s.content.trim().length > 0);

                        if (sections.length > 0) {
                          return (
                            <div className="space-y-6">
                              {sections.map((s) => (
                                <div key={s.title}>
                                  <h4 className="text-sm font-medium mb-2">{s.title}</h4>
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">
                                      {s.content}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                      }

                      if (currentPhase === 6) {
                        const sections = [
                          { title: 'Scene Brief', content: typeof obj.scene_brief === 'string' ? obj.scene_brief : '' },
                          { title: 'First Draft', content: typeof obj.first_draft === 'string' ? obj.first_draft : '' },
                          { title: 'Improvement Plan', content: typeof obj.improvement_plan === 'string' ? obj.improvement_plan : '' },
                          { title: 'Final Chapter', content: typeof obj.final_chapter === 'string' ? obj.final_chapter : '' },
                          { title: 'Updated Context Bundle', content: typeof obj.updated_context_bundle === 'string' ? obj.updated_context_bundle : '' },
                        ].filter((s) => typeof s.content === 'string' && s.content.trim().length > 0);

                        if (sections.length > 0) {
                          return (
                            <div className="space-y-6">
                              {sections.map((s) => (
                                <div key={s.title}>
                                  <h4 className="text-sm font-medium mb-2">{s.title}</h4>
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">
                                      {s.content}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                      }
                    }

                    const extracted = extractContent(parsedData);

                    if (extracted) {
                      return (
                        <div>
                          <h4 className="text-sm font-medium mb-2">{extracted.title}</h4>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">
                              {extracted.content}
                            </pre>
                          </div>
                        </div>
                      );
                    }

                    // Fallback: show raw JSON
                    return (
                      <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">
                        {JSON.stringify(parsedData || {}, null, 2)}
                      </div>
                    );
                  })()}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {completionData && (
              <div className="flex gap-2 mr-auto flex-wrap">
                {/* Phase 1: Save individual or all artifacts */}
                {currentPhase === 1 && completionData.artifacts && (
                  <>
                    <Button variant="outline" size="sm"
                      onClick={() => {
                        if (activeTab === 'genre_tropes' && completionData.artifacts.genre_tropes) {
                          handleSaveOutput('genre_tropes', 'Genre Tropes', completionData.artifacts.genre_tropes);
                        } else if (activeTab === 'style_sheet' && completionData.artifacts.style_sheet) {
                          handleSaveOutput('style_sheet', 'Style Sheet', completionData.artifacts.style_sheet);
                        } else if (activeTab === 'context_bundle' && completionData.artifacts.context_bundle) {
                          handleSaveOutput('context_bundle', 'Context Bundle', completionData.artifacts.context_bundle);
                        }
                      }}>
                      <Pin className="w-4 h-4 mr-2" />
                      Save {activeTab === 'genre_tropes' ? 'Genre Tropes' : activeTab === 'style_sheet' ? 'Style Sheet' : 'Context Bundle'}
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => {
                        if (completionData.artifacts.genre_tropes) handleSaveOutput('genre_tropes', 'Genre Tropes', completionData.artifacts.genre_tropes);
                        if (completionData.artifacts.style_sheet) handleSaveOutput('style_sheet', 'Style Sheet', completionData.artifacts.style_sheet);
                        if (completionData.artifacts.context_bundle) handleSaveOutput('context_bundle', 'Context Bundle', completionData.artifacts.context_bundle);
                        toast({ title: 'All outputs saved', description: 'All Phase 1 artifacts have been saved to context.' });
                      }}>
                      <Pin className="w-4 h-4 mr-2" />Save All
                    </Button>
                  </>
                )}
                {/* Phase 2-7: Save result/output */}
                {currentPhase !== 1 && completionData && (
                  <Button variant="outline" size="sm"
                    onClick={() => {
                      // Parse and extract the actual content
                      let parsedData: unknown = completionData;
                      if (typeof completionData === 'string') {
                        try {
                          parsedData = JSON.parse(completionData);
                        } catch (e) {
                          parsedData = completionData;
                        }
                      }
                      
                      // Extract content based on phase
                      let content = '';
                      let outputName = `Phase ${currentPhase} Output`;
                      
                      if (parsedData && typeof parsedData === 'object') {
                        const obj = parsedData as Record<string, unknown>;

                        if (typeof obj.series_outline === 'string') {
                          content = obj.series_outline;
                          outputName = 'Series Outline';
                        } else if (typeof obj.call_sheet === 'string') {
                          content = obj.call_sheet;
                          outputName = 'Call Sheet';
                        } else if (typeof obj.character_profiles === 'string') {
                          content = obj.character_profiles;
                          outputName = 'Character Profiles';
                        } else if (typeof obj.characters === 'string') {
                          content = obj.characters;
                          outputName = 'Character Profiles';
                        } else if (typeof obj.worldbuilding === 'string') {
                          content = obj.worldbuilding;
                          outputName = 'Worldbuilding';
                        } else if (typeof obj.outline === 'string') {
                          content = obj.outline;
                          outputName = 'Chapter Outline';
                        } else if (typeof obj.chapter_outline === 'string') {
                          content = obj.chapter_outline;
                          outputName = 'Chapter Outline';
                        } else if (typeof obj.scene_brief === 'string') {
                          content = obj.scene_brief;
                          outputName = 'Scene Brief';
                        } else if (typeof obj.first_draft === 'string') {
                          content = obj.first_draft;
                          outputName = 'First Draft';
                        } else if (typeof obj.improvement_plan === 'string') {
                          content = obj.improvement_plan;
                          outputName = 'Improvement Plan';
                        } else if (typeof obj.final_chapter === 'string') {
                          content = obj.final_chapter;
                          outputName = 'Final Chapter';
                        } else if (typeof obj.updated_context_bundle === 'string') {
                          content = obj.updated_context_bundle;
                          outputName = 'Updated Context Bundle';
                        } else if (typeof obj.final_manuscript === 'string') {
                          content = obj.final_manuscript;
                          outputName = 'Final Manuscript';
                        } else if (typeof obj.result === 'string') {
                          content = obj.result;
                        } else if (typeof obj.output === 'string') {
                          content = obj.output;
                        } else if (typeof obj.content === 'string') {
                          content = obj.content;
                        }
                      } else if (typeof parsedData === 'string') {
                        content = parsedData;
                      }
                      
                      if (content) {
                        handleSaveOutput(`phase_${currentPhase}_output`, outputName, content);
                      }
                    }}>
                    <Pin className="w-4 h-4 mr-2" />
                    Save Output
                  </Button>
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => setIsCompletionDialogOpen(false)}>Close</Button>
            {currentPhase < 7 && (
              <Button onClick={() => {
                setIsCompletionDialogOpen(false);
                // Move to next phase
                const nextPhase = currentPhase + 1;
                setCurrentPhase(nextPhase);

                // Auto-start Phase 2 if completing Phase 1
                if (currentPhase === 1) {
                  toast({
                    title: 'Moving to Phase 2',
                    description: 'Ready to start brainstorming your series outline.',
                  });
                  // Give user a moment before potentially auto-starting
                  setTimeout(() => {
                    setPhaseToRun(2);
                    setIsConfirmRunOpen(true);
                  }, 1000);
                }
              }}>
                Continue to Phase {currentPhase + 1} <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Artifact Viewing Dialog */}
      <Dialog open={isArtifactViewOpen} onOpenChange={setIsArtifactViewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-3">
              {viewingArtifact?.name}
              {viewingArtifact?.pinned && (
                <Badge variant="outline" className="text-xs">
                  <Pin className="w-3 h-3 mr-1" />
                  Pinned
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Review and manage this artifact
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 h-[500px]">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                {viewingArtifact?.content || 'No content available'}
              </pre>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewingArtifact) {
                  handleToggleSave(viewingArtifact);
                }
              }}
            >
              <Pin className="w-4 h-4 mr-2" />
              {viewingArtifact?.pinned ? 'Remove from Context' : 'Save to Context'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingArtifact?.content) {
                  navigator.clipboard.writeText(viewingArtifact.content);
                  toast({
                    title: 'Copied to clipboard',
                    description: 'Artifact content has been copied.',
                  });
                }
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Content
            </Button>
            <Button onClick={() => setIsArtifactViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout >
  );
}