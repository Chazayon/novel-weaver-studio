import { useState, useEffect } from 'react';
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
  useCancelWorkflow
} from '@/api/hooks';
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
  Pin,
  Loader2,
  XCircle
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
  const executePhase = useExecutePhase();
  const cancelWorkflow = useCancelWorkflow();

  const [currentPhase, setCurrentPhase] = useState(1);
  const [isPhasesOpen, togglePhasesOpen] = usePanelState('cockpit-phases', true);
  const [isContextOpen, toggleContextOpen] = usePanelState('cockpit-context', true);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [isPhase1InputOpen, setIsPhase1InputOpen] = useState(false);
  const [isConfirmRunOpen, setIsConfirmRunOpen] = useState(false);
  const [phaseToRun, setPhaseToRun] = useState<number | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);
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
  const [phaseInputs, setPhaseInputs] = useState<Record<string, any>>({});
  const [workflowStartTimes, setWorkflowStartTimes] = useState<Record<number, number>>({});
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'genre_tropes' | 'style_sheet' | 'context_bundle'>('genre_tropes');

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

  // Convert artifacts data
  const artifacts: Artifact[] = (artifactsData || []).map((a, idx) => ({
    id: String(idx),
    name: a.name,
    type: getArtifactType(a.name),
    content: '',
    updatedAt: new Date(a.updatedAt),
    pinned: false,
  }));

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
    } else if (phase.id === 1 && phase.status === 'in-progress') {
      // Phase 1 is special - it collects inputs via signals during execution
      // Don't mark inputs as complete just because it's running
      completed = 0;
    } else if (phase.status === 'in-progress' && !hasPendingInput) {
      // Phase is running but not waiting for input - inputs must have been provided
      completed = phase.requiredInputs.length;
    } else if (phase.status === 'in-progress' && hasPendingInput) {
      // Phase is waiting for input - check if we have any phaseInputs stored
      // For Phase 1, count which inputs have been provided
      if (phase.id === 1) {
        if (phaseInputs.genre) completed++;
        if (phaseInputs.book_title) completed++;
        if (phaseInputs.initial_ideas) completed++;
      }
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
    } catch (error: any) {
      console.error('Cancel workflow error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel workflow',
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
          setCompletionData(statusData.outputs);
          setIsCompletionDialogOpen(true);

          // Clear running state
          setRunningPhases(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentPhase);
            return newSet;
          });
          setCurrentWorkflowId(null);
          refetchProgress();
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

  // Mock output content based on phase
  const getPhaseOutputContent = () => {
    switch (activePhase.id) {
      case 1:
        return "# Research Results\n\n## Genre Analysis\n- Fantasy market trends show strong demand for epic narratives\n- Character-driven stories are performing well\n\n## Competitive Titles\n1. The Name of the Wind\n2. The Way of Kings\n3. Mistborn";
      case 2:
        return "# Series Outline\n\n## Arc 1: The Awakening (Books 1-3)\n- Introduction to the world\n- Discovery of the ancient prophecy\n\n## Arc 2: The Conflict (Books 4-6)\n- Rising tensions between kingdoms\n- Hero's transformation";
      case 3:
        return "# Call Sheet\n\n## Main Characters\n- **Elena Thornwood**: Protagonist, reluctant queen\n- **Marcus Vale**: Mentor figure, retired knight\n\n## Key Locations\n- Castle Thornwood\n- The Whispering Forest";
      case 4:
        return "# Characters & Worldbuilding\n\n## Character Profiles\n### Elena Thornwood\n- Age: 24\n- Role: Reluctant heir to the throne\n- Motivation: Protect her people\n\n## World Details\n- Magic system based on elemental bonds\n- Three major kingdoms in alliance";
      case 5:
        return "# Chapter Outline\n\n## Chapter 1: The Summons\n- Elena receives urgent message\n- Introduction to court politics\n\n## Chapter 2: Hidden Truths\n- Discovery of the ancient library\n- First hint of magical ability";
      case 6:
        return "# Chapter Writing Progress\n\nCompleted chapters: 5/24\n\nReady for final compilation.\n\n[View in Chapter Studio for detailed editing]";
      case 7:
        return "# Final Manuscript\n\nAll chapters compiled and ready for export.";
      default:
        return "No output available yet.";
    }
  };

  const handleViewOutputs = () => {
    setIsOutputModalOpen(true);
  };

  // Show confirmation dialog before running phase
  const handleRunPhaseClick = () => {
    // For Phase 1, show input dialog directly
    if (currentPhase === 1) {
      setIsPhase1InputOpen(true);
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

      const inputs: Record<string, any> = {};

      // For Phase 1, use the form inputs
      if (phaseNum === 1) {
        inputs.genre = phase1FormData.genre || projects?.find(p => p.id === projectId)?.genre || '';
        inputs.book_title = phase1FormData.book_title || projects?.find(p => p.id === projectId)?.title || '';
        inputs.initial_ideas = phase1FormData.initial_ideas;
        inputs.writing_samples = phase1FormData.writing_samples;
        inputs.outline_template = phase1FormData.outline_template;
        inputs.prohibited_words = phase1FormData.prohibited_words;
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

    } catch (error: any) {
      setRunningPhases(prev => {
        const newSet = new Set(prev);
        newSet.delete(phaseNum);
        return newSet;
      });

      console.error('Phase execution error:', error);

      // Get detailed error message
      let errorMessage = 'Failed to start phase';
      if (error?.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((e: any) =>
            `${e.loc?.join('.') || 'field'}: ${e.msg}`
          ).join(', ');
        } else {
          errorMessage = error.response.data.detail;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error executing phase',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Handle review approval/rejection
  const handleApproveReview = async () => {
    if (!currentWorkflowId) return;

    try {
      await apiClient.signalWorkflow(currentWorkflowId, {
        signal_name: 'user_review_signal',
        args: { approved: true, feedback: '' }
      });

      setIsReviewDialogOpen(false);
      toast({
        title: 'Review approved',
        description: 'Workflow will continue with approved content.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve review',
        variant: 'destructive',
      });
    }
  };

  const handleRejectReview = async () => {
    if (!currentWorkflowId) return;

    try {
      await apiClient.signalWorkflow(currentWorkflowId, {
        signal_name: 'user_review_signal',
        args: { approved: false, feedback: 'Please revise' }
      });

      setIsReviewDialogOpen(false);
      toast({
        title: 'Review rejected',
        description: 'Workflow will revise the content.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject review',
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

  const handleEditInEditor = () => {
    if (activePhase.id === 6) {
      navigate('/chapter-studio');
    } else if (activePhase.id === 7) {
      navigate('/compile');
    } else {
      navigate(`/ phase - editor / ${activePhase.id}`);
    }
  };

  const pinnedArtifacts = artifacts.filter(a => a.pinned);

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
                <Button onClick={() => navigate('/chapter-studio')} size="sm" className="w-full sm:w-auto">
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
                disabled={activePhase.status === 'not-started'}
                onClick={handleViewOutputs}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden md:inline">View Outputs</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={activePhase.status === 'not-started'}
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
                  <ArtifactCard artifact={artifact} />
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
            {/* Pinned artifacts */}
            {pinnedArtifacts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pinned
                  </span>
                </div>
                <div className="space-y-2">
                  {pinnedArtifacts.map((artifact) => (
                    <ArtifactCard key={artifact.id} artifact={artifact} compact />
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
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
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

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Workflow Output</DialogTitle>
            <DialogDescription>
              {reviewDescription || 'Please review the generated content and approve or request revisions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap font-mono text-sm">{reviewContent}</pre>
            </div>
          </div>

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

          {/* Phase 1 Artifacts Display */}
          {currentPhase === 1 && completionData?.artifacts ? (
            <div className="flex-1 overflow-hidden">
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  Phase 1 has generated the following artifacts for your novel:
                </p>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                  <button
                    onClick={() => setActiveTab('genre_tropes')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'genre_tropes'
                      ? 'bg-background text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Genre Tropes
                  </button>
                  <button
                    onClick={() => setActiveTab('style_sheet')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'style_sheet'
                      ? 'bg-background text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Style Sheet
                  </button>
                  <button
                    onClick={() => setActiveTab('context_bundle')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'context_bundle'
                      ? 'bg-background text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Context Bundle
                  </button>
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="p-4">
                    {activeTab === 'genre_tropes' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                          {completionData.artifacts.genre_tropes || 'No content available'}
                        </pre>
                      </div>
                    )}
                    {activeTab === 'style_sheet' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                          {completionData.artifacts.style_sheet || 'No content available'}
                        </pre>
                      </div>
                    )}
                    {activeTab === 'context_bundle' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                          {completionData.artifacts.context_bundle || 'No content available'}
                        </pre>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            /* Generic completion data for other phases */
            <div className="py-4 space-y-4 flex-1 overflow-hidden">
              <ScrollArea className="h-[400px]">
                <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">
                  {completionData?.result || completionData?.output || JSON.stringify(completionData || {}, null, 2)}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCompletionDialogOpen(false)}>
              Close
            </Button>
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
    </AppLayout >
  );
}
