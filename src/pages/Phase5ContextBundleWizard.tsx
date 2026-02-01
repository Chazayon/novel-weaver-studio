import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WizardStepper } from '@/components/shared/WizardStepper';
import { MarkdownEditor } from '@/components/shared/MarkdownEditor';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { apiClient } from '@/api/client';
import { queryKeys, usePhaseStatus, useProjects } from '@/api/hooks';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/hooks/useProjectContext';
import { usePanelState } from '@/hooks/usePanelState';
import { Settings, BookOpen } from 'lucide-react';

type StepId = 'curate' | 'tags';

type WizardStepState = {
  generatedAt?: string;
  approvedAt?: string;
  approvalNotes?: string;
};

type WizardState = {
  schemaVersion: number;
  extraNotes?: string;
  steps: Record<StepId, WizardStepState>;
  updatedAt: string;
};

const STEP_ORDER: Array<{ id: StepId; label: string }> = [
  { id: 'curate', label: 'Curate Context Bundle' },
  { id: 'tags', label: 'Generate Tags' },
];

function nowIso() {
  return new Date().toISOString();
}

function wizardStatePath() {
  return 'phase5_outputs/context_bundle_wizard_state.json';
}

export default function Phase5ContextBundleWizard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { projectId: selectedProjectId, setProjectId, getLastProjectId } = useProjectContext();

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [isControlsOpen, toggleControlsOpen] = usePanelState('phase5-context-controls', true, selectedProjectId);

  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const [extraNotes, setExtraNotes] = useState('');
  const [approvalNotes, setApprovalNotes] = useState<Record<StepId, string>>({ curate: '', tags: '' });

  const [bundleText, setBundleText] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<StepId | null>(null);

  const phaseStatus = usePhaseStatus(selectedProjectId || undefined, 5, runningWorkflowId || undefined, {
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

  const emptyWizardState = useCallback((): WizardState => {
    return {
      schemaVersion: 1,
      steps: {
        curate: {},
        tags: {},
      },
      updatedAt: nowIso(),
    };
  }, []);

  const persistWizardState = useCallback(
    async (projectId: string, nextState: WizardState) => {
      await apiClient.updateArtifact(projectId, wizardStatePath(), {
        content: JSON.stringify({ ...nextState, updatedAt: nowIso() }, null, 2),
      });
    },
    []
  );

  const loadWizardState = useCallback(
    async (projectId: string) => {
      try {
        const res = await apiClient.getArtifact(projectId, wizardStatePath());
        const parsed = JSON.parse(res.content) as WizardState;
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid wizard state');
        setWizardState(parsed);
        setExtraNotes(parsed.extraNotes || '');
        setApprovalNotes({
          curate: parsed.steps?.curate?.approvalNotes || '',
          tags: parsed.steps?.tags?.approvalNotes || '',
        });
      } catch {
        const created = emptyWizardState();
        setWizardState(created);
        try {
          await persistWizardState(projectId, created);
        } catch {
          // best-effort
        }
      }
    },
    [emptyWizardState, persistWizardState]
  );

  const loadBundle = useCallback(async (projectId: string) => {
    try {
      const res = await apiClient.getArtifact(projectId, 'phase1_outputs/context_bundle.md');
      setBundleText(res.content || '');
    } catch {
      setBundleText('');
    }
  }, []);

  const loadTags = useCallback(async (projectId: string) => {
    try {
      const res = await apiClient.getArtifact(projectId, 'phase1_outputs/context_bundle_tags.json');
      setTagsText(res.content || '');
    } catch {
      setTagsText('');
    }
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadWizardState(selectedProjectId);
    void loadBundle(selectedProjectId);
    void loadTags(selectedProjectId);
  }, [selectedProjectId, loadWizardState, loadBundle, loadTags]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (phaseStatus.data?.status !== 'completed') return;
    if (!runningWorkflowId || !runningStep) return;

    const finished = runningStep;
    setRunningWorkflowId(null);
    setRunningStep(null);

    void (async () => {
      if (finished === 'curate') {
        await loadBundle(selectedProjectId);
      }
      if (finished === 'tags') {
        await loadTags(selectedProjectId);
      }

      setWizardState((prev) => {
        const base = prev || emptyWizardState();
        const next: WizardState = {
          ...base,
          extraNotes,
          steps: {
            ...base.steps,
            [finished]: {
              ...base.steps[finished],
              generatedAt: base.steps[finished]?.generatedAt || nowIso(),
            },
          },
          updatedAt: nowIso(),
        };
        void persistWizardState(selectedProjectId, next);
        return next;
      });
    })();
  }, [phaseStatus.data?.status, selectedProjectId, runningWorkflowId, runningStep, loadBundle, loadTags, emptyWizardState, persistWizardState, extraNotes]);

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
    if (!selectedProjectId || !activeStep) return false;
    if (runningWorkflowId) return false;
    if (!wizardState) return false;
    if (!canEnterStep(activeStepIndex)) return false;
    return true;
  }, [selectedProjectId, activeStep, runningWorkflowId, wizardState, canEnterStep, activeStepIndex]);

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

  const handleGenerate = async () => {
    if (!selectedProjectId || !activeStep) return;

    try {
      if (activeStep === 'curate') {
        const result = await apiClient.executePhase(selectedProjectId, 5, {
          phase: 5,
          inputs: {
            step: 'curate-context-bundle',
            extra_notes: extraNotes,
          },
        });
        setRunningWorkflowId(result.workflowId);
        setRunningStep('curate');
        return;
      }

      if (activeStep === 'tags') {
        const result = await apiClient.executePhase(selectedProjectId, 5, {
          phase: 5,
          inputs: {
            step: 'context-tags',
          },
        });
        setRunningWorkflowId(result.workflowId);
        setRunningStep('tags');
        return;
      }
    } catch (e) {
      toast({
        title: 'Failed to start',
        description: e instanceof Error ? e.message : 'Could not start the workflow step',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSetup = async () => {
    if (!selectedProjectId) return;
    const next: WizardState = {
      ...(wizardState || emptyWizardState()),
      extraNotes,
      updatedAt: nowIso(),
    };

    setWizardState(next);

    try {
      await persistWizardState(selectedProjectId, next);
      toast({ title: 'Saved', description: 'Wizard setup saved.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save wizard setup',
        variant: 'destructive',
      });
    }
  };

  const approveStep = async (step: StepId) => {
    if (!selectedProjectId) return;

    const next: WizardState = {
      ...(wizardState || emptyWizardState()),
      extraNotes,
      steps: {
        ...(wizardState?.steps || emptyWizardState().steps),
        [step]: {
          ...(wizardState?.steps?.[step] || {}),
          approvalNotes: approvalNotes[step] || '',
          approvedAt: nowIso(),
        },
      },
      updatedAt: nowIso(),
    };

    setWizardState(next);

    try {
      await persistWizardState(selectedProjectId, next);
      queryClient.invalidateQueries({ queryKey: queryKeys.chapters(selectedProjectId) });
      toast({ title: 'Approved', description: `Approved: ${STEP_ORDER.find((s) => s.id === step)?.label || step}` });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to persist approval',
        variant: 'destructive',
      });
    }
  };

  const handleSaveArtifact = async (kind: StepId, content: string) => {
    if (!selectedProjectId) return;

    const path = kind === 'curate' ? 'phase1_outputs/context_bundle.md' : 'phase1_outputs/context_bundle_tags.json';

    try {
      await apiClient.updateArtifact(selectedProjectId, path, { content });
      if (kind === 'curate') setBundleText(content);
      if (kind === 'tags') setTagsText(content);
      toast({ title: 'Saved', description: 'Artifact saved.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save artifact',
        variant: 'destructive',
      });
    }
  };

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Choose a Project</h2>
            <p className="text-muted-foreground mb-4">Select a project to create the context bundle.</p>

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
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Center - Editor workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
          {/* Header */}
          <div className="p-3 lg:p-4 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  <span className="gradient-text">Phase 5.0 Context Bundle</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Curate canonical context and tags for outlining and drafting
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!selectedProjectId) return;
                  navigate(`/drafting-wizard?projectId=${selectedProjectId}`);
                }}
              >
                Drafting Wizard
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
                      if (activeStep === 'curate') void loadBundle(selectedProjectId);
                      if (activeStep === 'tags') void loadTags(selectedProjectId);
                    }}
                    disabled={!selectedProjectId}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                {activeStep === 'curate' ? (
                  <MarkdownEditor
                    value={bundleText}
                    onChange={setBundleText}
                    onSave={() => handleSaveArtifact('curate', bundleText)}
                    className="h-full"
                  />
                ) : (
                  <MarkdownEditor
                    value={tagsText}
                    onChange={setTagsText}
                    onSave={() => handleSaveArtifact('tags', tagsText)}
                    className="h-full"
                  />
                )}
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
            {/* Setup */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                Setup
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
                  <Label className="text-sm">Extra notes (optional)</Label>
                  <Textarea
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="min-h-[80px] bg-muted/50 border-border text-sm"
                    placeholder="Themes, constraints, canon decisions..."
                  />
                </div>

                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSaveSetup} 
                  disabled={!selectedProjectId}
                  className="w-full"
                >
                  Save setup
                </Button>

                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  <p className="mb-1">This wizard creates:</p>
                  <code className="text-[10px] block">phase1_outputs/context_bundle.md</code>
                  <code className="text-[10px] block">phase1_outputs/context_bundle_tags.json</code>
                </div>
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
                      onChange={(e) => setApprovalNotes((prev) => ({ ...prev, [activeStep]: e.target.value }))}
                      className="min-h-[80px] bg-muted/50 border-border text-sm"
                      placeholder="Canon decisions, what was approved..."
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (activeStepIndex < STEP_ORDER.length - 1 && canEnterStep(activeStepIndex + 1)) {
                          setActiveStepIndex(activeStepIndex + 1);
                          return;
                        }

                        if (activeStepIndex === STEP_ORDER.length - 1 && selectedProjectId) {
                          navigate(`/cockpit?projectId=${selectedProjectId}&phase=5`);
                        }
                      }}
                      disabled={!wizardState?.steps?.[activeStep]?.approvedAt}
                      className="w-full"
                    >
                      {activeStepIndex === STEP_ORDER.length - 1 ? 'Go to Workflow' : 'Next step'}
                    </Button>
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
