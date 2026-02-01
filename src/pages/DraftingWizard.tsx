import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WizardStepper } from '@/components/shared/WizardStepper';
import { MarkdownEditor } from '@/components/shared/MarkdownEditor';
import { WorkflowReviewDialog } from '@/components/workflow/WorkflowReviewDialog';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { apiClient } from '@/api/client';
import { queryKeys, useChapters, usePhaseStatus, useProjects } from '@/api/hooks';
import type { ChapterDetail } from '@/api/types';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/hooks/useProjectContext';
import { usePanelState } from '@/hooks/usePanelState';
import { Settings, BookOpen } from 'lucide-react';

type StepId = 'scene-brief' | 'draft' | 'improve-plan' | 'apply-improvement-plan' | 'final';

type WizardStepState = {
  generatedAt?: string;
  approvedAt?: string;
  approvalNotes?: string;
};

type WizardState = {
  schemaVersion: number;
  chapterNumber: number;
  chapterTitle: string;
  chapterNotes?: string;
  targetWordCount?: number;
  tone?: string;
  steps: Record<StepId, WizardStepState>;
  completedAt?: string;
  updatedAt: string;
};

const tones = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'gritty', label: 'Gritty' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'dark', label: 'Dark' },
  { value: 'whimsical', label: 'Whimsical' },
];

const STEP_ORDER: Array<{ id: StepId; label: string }> = [
  { id: 'scene-brief', label: 'Scene Brief' },
  { id: 'draft', label: 'First Draft' },
  { id: 'improve-plan', label: 'Improvement Plan' },
  { id: 'apply-improvement-plan', label: 'Apply Plan' },
  { id: 'final', label: 'Final Revise' },
];

function nowIso() {
  return new Date().toISOString();
}

function wizardStatePath(chapterNumber: number) {
  return `phase7_outputs/chapter_${chapterNumber}/wizard_state.json`;
}

function legacyWizardStatePath(chapterNumber: number) {
  return `phase6_outputs/chapter_${chapterNumber}/wizard_state.json`;
}

function artifactPathForStep(chapterNumber: number, step: StepId) {
  const base = `phase7_outputs/chapter_${chapterNumber}`;
  switch (step) {
    case 'scene-brief':
      return `${base}/scene_brief.md`;
    case 'draft':
      return `${base}/first_draft.md`;
    case 'improve-plan':
      return `${base}/improvement_plan.md`;
    case 'apply-improvement-plan':
      return `${base}/revised_draft.md`;
    case 'final':
      return `${base}/final.md`;
    default:
      return `${base}/final.md`;
  }
}

function legacyArtifactPathForStep(chapterNumber: number, step: StepId) {
  const base = `phase6_outputs/chapter_${chapterNumber}`;
  switch (step) {
    case 'scene-brief':
      return `${base}/scene_brief.md`;
    case 'draft':
      return `${base}/first_draft.md`;
    case 'improve-plan':
      return `${base}/improvement_plan.md`;
    case 'apply-improvement-plan':
      return `${base}/revised_draft.md`;
    case 'final':
      return `${base}/final.md`;
    default:
      return `${base}/final.md`;
  }
}

function emptyWizardState(chapterNumber: number, chapterTitle: string): WizardState {
  return {
    schemaVersion: 1,
    chapterNumber,
    chapterTitle,
    steps: {
      'scene-brief': {},
      draft: {},
      'improve-plan': {},
      'apply-improvement-plan': {},
      final: {},
    },
    updatedAt: nowIso(),
  };
}

export default function DraftingWizard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId: selectedProjectId, setProjectId, getLastProjectId } = useProjectContext();

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [isControlsOpen, toggleControlsOpen] = usePanelState('drafting-wizard-controls', true, selectedProjectId);

  const { data: chaptersData } = useChapters(selectedProjectId || undefined);
  const chaptersList: ChapterDetail[] = useMemo(() => (chaptersData || []) as ChapterDetail[], [chaptersData]);

  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [chapterTitle, setChapterTitle] = useState<string>('');
  const [chapterNotes, setChapterNotes] = useState<string>('');
  const [targetWordCount, setTargetWordCount] = useState<number>(3000);
  const [tone, setTone] = useState<string>('neutral');

  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<StepId | null>(null);

  const [stepContent, setStepContent] = useState<Record<StepId, string>>({
    'scene-brief': '',
    draft: '',
    'improve-plan': '',
    'apply-improvement-plan': '',
    final: '',
  });

  const [approvalNotes, setApprovalNotes] = useState<Record<StepId, string>>({
    'scene-brief': '',
    draft: '',
    'improve-plan': '',
    'apply-improvement-plan': '',
    final: '',
  });

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewExpectedOutputs, setReviewExpectedOutputs] = useState<string[]>([]);

  const phaseStatus = usePhaseStatus(selectedProjectId || undefined, 7, runningWorkflowId || undefined, {
    enabled: !!selectedProjectId && !!runningWorkflowId,
    ...(runningWorkflowId ? { refetchInterval: 2000 } : {}),
  });

  useEffect(() => {
    if (!selectedProjectId && !projectsLoading) {
      const lastProject = getLastProjectId();
      if (lastProject && projects?.some(p => p.id === lastProject)) {
        setProjectId(lastProject);
      } else if (projects && projects.length === 1) {
        setProjectId(projects[0].id);
      }
    }
  }, [selectedProjectId, projects, projectsLoading, getLastProjectId, setProjectId]);

  useEffect(() => {
    if (chaptersList.length > 0 && chapterNumber === 1) {
      const next = chaptersList.find((c) => c.status !== 'completed') || chaptersList[0];
      if (next) {
        setChapterNumber(next.number);
        setChapterTitle(next.title || '');
      }
    }
  }, [chaptersList, chapterNumber]);

  const persistWizardState = useCallback(
    async (nextState: WizardState) => {
      if (!selectedProjectId) return;
      const path = wizardStatePath(nextState.chapterNumber);
      await apiClient.updateArtifact(selectedProjectId, path, {
        content: JSON.stringify({ ...nextState, updatedAt: nowIso() }, null, 2),
      });
    },
    [selectedProjectId]
  );

  const loadWizardState = useCallback(async (projectId: string, chNum: number, title: string) => {
    try {
      const res = await apiClient.getArtifact(projectId, wizardStatePath(chNum));
      const parsed = JSON.parse(res.content) as WizardState;
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid wizard state');
      setWizardState(parsed);
      setChapterTitle(parsed.chapterTitle || title);
      setChapterNotes(parsed.chapterNotes || '');
      setTargetWordCount(parsed.targetWordCount || 3000);
      setTone(parsed.tone || 'neutral');
      setApprovalNotes((prev) => {
        const next = { ...prev };
        for (const s of STEP_ORDER.map((x) => x.id)) {
          next[s] = parsed.steps?.[s]?.approvalNotes || '';
        }
        return next;
      });
    } catch {
      try {
        const legacyRes = await apiClient.getArtifact(projectId, legacyWizardStatePath(chNum));
        const parsed = JSON.parse(legacyRes.content) as WizardState;
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid wizard state');
        setWizardState(parsed);
        setChapterTitle(parsed.chapterTitle || title);
        setChapterNotes(parsed.chapterNotes || '');
        setTargetWordCount(parsed.targetWordCount || 3000);
        setTone(parsed.tone || 'neutral');
        setApprovalNotes((prev) => {
          const next = { ...prev };
          for (const s of STEP_ORDER.map((x) => x.id)) {
            next[s] = parsed.steps?.[s]?.approvalNotes || '';
          }
          return next;
        });
      } catch {
        const created = emptyWizardState(chNum, title);
        setWizardState(created);
        try {
          await apiClient.updateArtifact(projectId, wizardStatePath(chNum), {
            content: JSON.stringify(created, null, 2),
          });
        } catch {
          // best-effort
        }
      }
    }
  }, []);

  const loadStepArtifact = useCallback(async (projectId: string, chNum: number, step: StepId) => {
    try {
      const res = await apiClient.getArtifact(projectId, artifactPathForStep(chNum, step));
      setStepContent((prev) => ({ ...prev, [step]: res.content || '' }));
      return res.content || '';
    } catch {
      try {
        const res = await apiClient.getArtifact(projectId, legacyArtifactPathForStep(chNum, step));
        setStepContent((prev) => ({ ...prev, [step]: res.content || '' }));
        return res.content || '';
      } catch {
        setStepContent((prev) => ({ ...prev, [step]: '' }));
        return '';
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const next = chaptersList.find((c) => c.number === chapterNumber);
    const title = next?.title || chapterTitle || '';
    void loadWizardState(selectedProjectId, chapterNumber, title);
  }, [selectedProjectId, chapterNumber, chaptersList, chapterTitle, loadWizardState]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const next = chaptersList.find((c) => c.number === chapterNumber);
    if (!next) return;
    if (!chapterTitle) setChapterTitle(next.title || '');
  }, [chaptersList, chapterNumber, chapterTitle, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !wizardState) return;
    const step = STEP_ORDER[activeStepIndex]?.id;
    if (!step) return;
    void loadStepArtifact(selectedProjectId, wizardState.chapterNumber, step);
  }, [selectedProjectId, wizardState, activeStepIndex, loadStepArtifact]);

  useEffect(() => {
    const pending = phaseStatus.data?.outputs?.pending_review as
      | { content?: string; description?: string; expectedOutputs?: string[] }
      | undefined;

    if (pending?.content) {
      setReviewContent(pending.content || '');
      setReviewDescription(pending.description || 'Please review the generated content.');
      setReviewExpectedOutputs(pending.expectedOutputs || []);
      setIsReviewDialogOpen(true);
    }

    if (phaseStatus.data?.status === 'completed' && runningWorkflowId && runningStep && selectedProjectId) {
      const finishedStep = runningStep;
      const chNum = chapterNumber;

      setRunningWorkflowId(null);
      setRunningStep(null);

      void (async () => {
        const content = await loadStepArtifact(selectedProjectId, chNum, finishedStep);
        setWizardState((prev) => {
          const base = prev || emptyWizardState(chNum, chapterTitle);
          const next: WizardState = {
            ...base,
            chapterNumber: chNum,
            chapterTitle,
            chapterNotes,
            targetWordCount,
            tone,
            steps: {
              ...base.steps,
              [finishedStep]: {
                ...base.steps[finishedStep],
                generatedAt: base.steps[finishedStep]?.generatedAt || nowIso(),
              },
            },
            updatedAt: nowIso(),
          };
          void persistWizardState(next);
          setStepContent((p) => ({ ...p, [finishedStep]: content }));
          return next;
        });
      })();
    }
  }, [
    phaseStatus.data?.status,
    phaseStatus.data?.outputs,
    runningWorkflowId,
    runningStep,
    selectedProjectId,
    chapterNumber,
    chapterTitle,
    chapterNotes,
    targetWordCount,
    tone,
    persistWizardState,
    loadStepArtifact,
  ]);

  const stepsForStepper = useMemo(() => {
    const current = STEP_ORDER[activeStepIndex]?.id;
    return STEP_ORDER.map((s, idx) => {
      const st = wizardState?.steps?.[s.id];
      const isApproved = !!st?.approvedAt;
      const isGenerated = !!st?.generatedAt;
      const isCurrent = s.id === current;

      let status: 'pending' | 'current' | 'completed' = 'pending';
      if (idx < activeStepIndex) status = 'completed';
      if (isCurrent) status = 'current';
      if (!isCurrent && (isApproved || isGenerated) && idx < activeStepIndex) status = 'completed';

      return { id: s.id, label: s.label, status };
    });
  }, [wizardState, activeStepIndex]);

  const activeStep = STEP_ORDER[activeStepIndex]?.id;

  const canEnterStep = useCallback(
    (idx: number) => {
      if (!wizardState) return false;
      if (idx <= 0) return true;
      const prevStep = STEP_ORDER[idx - 1]?.id;
      if (!prevStep) return true;
      return !!wizardState.steps?.[prevStep]?.approvedAt;
    },
    [wizardState]
  );

  const canGenerateActive = useMemo(() => {
    if (!selectedProjectId || !wizardState || !activeStep) return false;
    if (runningWorkflowId) return false;
    if (!chapterTitle.trim()) return false;
    if (!canEnterStep(activeStepIndex)) return false;

    const dependencies: Record<StepId, StepId[]> = {
      'scene-brief': [],
      draft: ['scene-brief'],
      'improve-plan': ['scene-brief', 'draft'],
      'apply-improvement-plan': ['improve-plan', 'draft'],
      final: ['apply-improvement-plan'],
    };

    for (const dep of dependencies[activeStep] || []) {
      if (!wizardState.steps?.[dep]?.generatedAt) return false;
    }

    return true;
  }, [
    selectedProjectId,
    wizardState,
    activeStep,
    runningWorkflowId,
    chapterTitle,
    activeStepIndex,
    canEnterStep,
  ]);

  const handleGenerate = async () => {
    if (!selectedProjectId || !activeStep) return;

    try {
      const result = await apiClient.executePhase(selectedProjectId, 7, {
        phase: 7,
        inputs: {
          chapter_number: chapterNumber,
          chapter_title: chapterTitle,
          chapter_notes: chapterNotes,
          target_word_count: targetWordCount,
          tone,
          step: activeStep,
        },
      });

      setRunningWorkflowId(result.workflowId);
      setRunningStep(activeStep);
    } catch (e) {
      toast({
        title: 'Failed to start',
        description: e instanceof Error ? e.message : 'Could not start the workflow step',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSetup = async () => {
    if (!wizardState || !selectedProjectId) return;

    const next: WizardState = {
      ...wizardState,
      chapterNumber,
      chapterTitle,
      chapterNotes,
      targetWordCount,
      tone,
      updatedAt: nowIso(),
    };

    try {
      setWizardState(next);
      await persistWizardState(next);
      toast({ title: 'Saved', description: 'Wizard setup saved.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save wizard setup',
        variant: 'destructive',
      });
    }
  };

  const handleSaveArtifact = async (step: StepId, content: string) => {
    if (!selectedProjectId) return;

    try {
      await apiClient.updateArtifact(selectedProjectId, artifactPathForStep(chapterNumber, step), { content });
      setStepContent((prev) => ({ ...prev, [step]: content }));
      toast({ title: 'Saved', description: 'Artifact saved.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save artifact',
        variant: 'destructive',
      });
    }
  };

  const approveStep = async (step: StepId) => {
    if (!wizardState) return;

    const isFinal = step === 'final';

    const next: WizardState = {
      ...wizardState,
      chapterNumber,
      chapterTitle,
      chapterNotes,
      targetWordCount,
      tone,
      steps: {
        ...wizardState.steps,
        [step]: {
          ...wizardState.steps[step],
          approvalNotes: approvalNotes[step] || '',
          approvedAt: nowIso(),
        },
      },
      completedAt: isFinal ? nowIso() : wizardState.completedAt,
      updatedAt: nowIso(),
    };

    setWizardState(next);

    try {
      await persistWizardState(next);
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.chapters(selectedProjectId) });
      }
      if (isFinal) {
        toast({
          title: 'Chapter completed',
          description: nextChapterNumber !== null ? 'Final approved. You can move to the next chapter.' : 'Final approved.',
        });
        return;
      }
      toast({ title: 'Approved', description: `Approved: ${STEP_ORDER.find((s) => s.id === step)?.label || step}` });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to persist approval',
        variant: 'destructive',
      });
    }
  };

  const nextChapterNumber = useMemo(() => {
    if (!chaptersList || chaptersList.length === 0) return null;
    const sorted = [...chaptersList].sort((a, b) => a.number - b.number);
    const idx = sorted.findIndex((c) => c.number === chapterNumber);
    if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1].number;
    const fallback = sorted.find((c) => c.number > chapterNumber);
    return fallback?.number ?? null;
  }, [chaptersList, chapterNumber]);

  const canGoToNextChapter = useMemo(() => {
    if (!wizardState) return false;
    if (activeStep !== 'final') return false;
    if (!wizardState.steps?.final?.approvedAt) return false;
    return nextChapterNumber !== null;
  }, [wizardState, activeStep, nextChapterNumber]);

  const goToNextChapter = useCallback(() => {
    if (!selectedProjectId) return;
    if (nextChapterNumber === null) {
      toast({ title: 'Done', description: 'No next chapter found.' });
      return;
    }

    setRunningWorkflowId(null);
    setRunningStep(null);
    setIsReviewDialogOpen(false);
    setReviewContent('');
    setReviewDescription('');
    setReviewExpectedOutputs([]);
    setActiveStepIndex(0);

    setWizardState(null);

    const ch = chaptersList.find((c) => c.number === nextChapterNumber);
    setChapterNumber(nextChapterNumber);
    setChapterTitle(ch?.title || '');
    setChapterNotes('');
    setTargetWordCount(3000);
    setTone('neutral');
    setStepContent({
      'scene-brief': '',
      draft: '',
      'improve-plan': '',
      'apply-improvement-plan': '',
      final: '',
    });
    setApprovalNotes({
      'scene-brief': '',
      draft: '',
      'improve-plan': '',
      'apply-improvement-plan': '',
      final: '',
    });
  }, [selectedProjectId, nextChapterNumber, chaptersList, toast]);

  const handleReviewSubmit = async (inputs: Record<string, string>) => {
    if (!runningWorkflowId) return;
    try {
      await apiClient.respondToWorkflow(runningWorkflowId, { inputs });
      setIsReviewDialogOpen(false);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to submit workflow response',
        variant: 'destructive',
      });
    }
  };

  const selectedChapterFromOutline = useMemo(() => {
    return chaptersList.find((c) => c.number === chapterNumber);
  }, [chaptersList, chapterNumber]);

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Choose a Project</h2>
            <p className="text-muted-foreground mb-4">Select a project to start the Drafting Wizard.</p>

            {projectsLoading ? (
              <p className="text-muted-foreground">Loading projects…</p>
            ) : (
              <div className="max-w-sm mx-auto text-left space-y-2">
                <Label>Project</Label>
                <Select
                  value={selectedProjectId || undefined}
                  onValueChange={(val) => setProjectId(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <WorkflowReviewDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        content={reviewContent}
        description={reviewDescription}
        expectedOutputs={reviewExpectedOutputs}
        onSubmit={handleReviewSubmit}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Center - Editor workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
          {/* Header */}
          <div className="p-3 lg:p-4 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  <span className="gradient-text">Drafting Wizard (Phase 7)</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Chapter {chapterNumber}: {chapterTitle || 'Untitled'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!selectedProjectId) return;
                  navigate(`/chapter-studio?projectId=${selectedProjectId}`);
                }}
              >
                Open Chapter Studio
              </Button>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="p-4 border-b border-border">
            <WizardStepper steps={stepsForStepper} currentStep={activeStepIndex} />
            <div className="flex flex-wrap gap-2 mt-4">
              {STEP_ORDER.map((s, idx) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={idx === activeStepIndex ? 'default' : 'outline'}
                  onClick={() => setActiveStepIndex(idx)}
                  disabled={!wizardState || !canEnterStep(idx)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Editor */}
          {activeStep && (
            <div className="flex-1 overflow-hidden min-h-0 h-full flex flex-col p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="text-sm text-muted-foreground">
                  {runningWorkflowId && runningStep === activeStep
                    ? `Running: ${runningWorkflowId}`
                    : wizardState?.steps?.[activeStep]?.generatedAt
                      ? `Generated: ${wizardState.steps[activeStep]?.generatedAt}`
                      : 'Not generated yet'}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleGenerate} disabled={!canGenerateActive}>
                    {runningWorkflowId && runningStep === activeStep ? 'Running…' : 'Generate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!selectedProjectId) return;
                      void loadStepArtifact(selectedProjectId, chapterNumber, activeStep);
                    }}
                    disabled={!selectedProjectId}
                  >
                    Refresh
                  </Button>
                  {!isControlsOpen && (
                    <Button size="sm" variant="outline" onClick={toggleControlsOpen}>
                      Open Control Panel
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <MarkdownEditor
                  value={stepContent[activeStep]}
                  onChange={(v) => setStepContent((prev) => ({ ...prev, [activeStep]: v }))}
                  onSave={() => handleSaveArtifact(activeStep, stepContent[activeStep])}
                  className="h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right - Control panel */}
        <CollapsiblePanel
          title="Control Panel"
          icon={<Settings className="w-4 h-4" />}
          isOpen={isControlsOpen}
          onToggle={toggleControlsOpen}
          side="right"
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-6 max-h-[calc(100vh-8rem)]">
            {/* Chapter Setup */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                Chapter Setup
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Project</Label>
                  <Select
                    value={selectedProjectId || ''}
                    onValueChange={(v) => setProjectId(v)}
                    disabled={projectsLoading || !projects || projects.length === 0}
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(projects || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Chapter</Label>
                  <Select
                    value={String(chapterNumber)}
                    onValueChange={(v) => {
                      const n = Number(v);
                      if (!Number.isFinite(n) || n <= 0) return;
                      setChapterNumber(n);
                      const ch = chaptersList.find((c) => c.number === n);
                      if (ch?.title) setChapterTitle(ch.title);
                    }}
                    disabled={!selectedProjectId || chaptersList.length === 0}
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select a chapter" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {chaptersList.map((c) => (
                        <SelectItem key={c.number} value={String(c.number)}>
                          Ch {c.number}: {c.title} {c.status === 'completed' ? '✅' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedChapterFromOutline && (
                    <p className="text-xs text-muted-foreground">
                      Status: {selectedChapterFromOutline.status}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Chapter title</Label>
                  <Input
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {tones.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Target word count</Label>
                  <Input
                    type="number"
                    value={targetWordCount}
                    onChange={(e) => setTargetWordCount(Number(e.target.value || 0) || 0)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Chapter notes</Label>
                  <Textarea
                    value={chapterNotes}
                    onChange={(e) => setChapterNotes(e.target.value)}
                    className="min-h-[80px] bg-muted/50 border-border text-sm"
                    placeholder="Continuity notes, constraints..."
                  />
                </div>

                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSaveSetup} 
                  disabled={!selectedProjectId || !wizardState}
                  className="w-full"
                >
                  Save setup
                </Button>
              </div>
            </div>

            {/* Approval Section */}
            {activeStep && (
              <div className="pt-4 border-t border-border">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  Approval
                </Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Approval notes</Label>
                    <Textarea
                      value={approvalNotes[activeStep] || ''}
                      onChange={(e) =>
                        setApprovalNotes((prev) => ({ ...prev, [activeStep]: e.target.value }))
                      }
                      className="min-h-[80px] bg-muted/50 border-border text-sm"
                      placeholder="What was approved? Follow-up notes..."
                    />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {wizardState?.steps?.[activeStep]?.approvedAt
                      ? `Approved: ${wizardState.steps[activeStep]?.approvedAt}`
                      : 'Not approved yet'}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => approveStep(activeStep)}
                      disabled={!wizardState?.steps?.[activeStep]?.generatedAt}
                      className="w-full"
                    >
                      Approve step
                    </Button>
                    {activeStep === 'final' ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={goToNextChapter} 
                        disabled={!canGoToNextChapter}
                        className="w-full"
                      >
                        Next chapter
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (activeStepIndex < STEP_ORDER.length - 1 && canEnterStep(activeStepIndex + 1)) {
                            setActiveStepIndex(activeStepIndex + 1);
                          }
                        }}
                        disabled={!wizardState?.steps?.[activeStep]?.approvedAt}
                        className="w-full"
                      >
                        Next step
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsiblePanel>
      </div>
    </AppLayout>
  );
}
