import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChapterRow } from '@/components/shared/ChapterRow';
import { EditorTabs } from '@/components/shared/EditorTabs';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePanelState } from '@/hooks/usePanelState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useChapters, useChapter, useProjects } from '@/api/hooks';
import { apiClient } from '@/api/client';
import { Artifact, Chapter } from '@/lib/mockData';
import {
  Play,
  Zap,
  FileText,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  Settings,
  Loader2
} from 'lucide-react';

const tones = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'gritty', label: 'Gritty' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'dark', label: 'Dark' },
  { value: 'whimsical', label: 'Whimsical' },
];

export default function ChapterStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || searchParams.get('project');

  const { data: projects, isLoading: projectsLoading } = useProjects();

  // Load saved outputs (pinned artifacts) for continuity reference
  const [savedOutputs, setSavedOutputs] = useState<Record<string, { content: string; name: string; type: string }>>({});

  // Loaded chapter artifacts
  const [sceneBriefContent, setSceneBriefContent] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [improvementPlanContent, setImprovementPlanContent] = useState('');
  const [finalContent, setFinalContent] = useState('');
  
  // Previous chapter content for continuity
  const [previousChapterContent, setPreviousChapterContent] = useState('');

  // Core continuity artifacts (outline / characters / worldbuilding / etc.)
  const [coreArtifacts, setCoreArtifacts] = useState<Artifact[]>([]);

  // API hooks
  const {
    data: chaptersData,
    isLoading: chaptersLoading,
    refetch: refetchChapters,
  } = useChapters(projectId || undefined);

  const [selectedChapterNumber, setSelectedChapterNumber] = useState(1);
  const {
    data: selectedChapterData,
    refetch: refetchSelectedChapter,
  } = useChapter(projectId || undefined, selectedChapterNumber);

  const [targetWordCount, setTargetWordCount] = useState([3000]);
  const [selectedTone, setSelectedTone] = useState('neutral');
  const [isRunning, setIsRunning] = useState(false);
  const [isChaptersOpen, toggleChaptersOpen] = usePanelState('chapter-studio-chapters', true, projectId);
  const [isControlsOpen, toggleControlsOpen] = usePanelState('chapter-studio-controls', true, projectId);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string | null>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [runningChapterNumber, setRunningChapterNumber] = useState<number | null>(null);

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewExpectedOutputs, setReviewExpectedOutputs] = useState<string[]>([]);
  const [reviewInputs, setReviewInputs] = useState<Record<string, string>>({});

  const [isNextChapterDialogOpen, setIsNextChapterDialogOpen] = useState(false);

  const refreshChapterArtifacts = useCallback(
    async (chapterNumber: number, step?: string | null) => {
      if (!projectId) return;
      const chapterDir = `phase6_outputs/chapter_${chapterNumber}`;

      const normalizedStep = (step || '').trim().toLowerCase();
      const shouldFetchAll = normalizedStep === '';

      const shouldFetchSceneBrief = shouldFetchAll || normalizedStep === 'scene-brief';
      const shouldFetchDraft = shouldFetchAll || normalizedStep === 'draft';
      const shouldFetchImprovePlan = shouldFetchAll || normalizedStep === 'improve-plan';
      const shouldFetchFinal = shouldFetchAll || normalizedStep === 'final';

      if (shouldFetchSceneBrief) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/scene_brief.md`);
          setSceneBriefContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (shouldFetchDraft) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/first_draft.md`);
          setDraftContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (shouldFetchImprovePlan) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/improvement_plan.md`);
          setImprovementPlanContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (shouldFetchFinal) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/final.md`);
          setFinalContent(res.content);
        } catch {
          // best-effort
        }
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId || !currentWorkflowId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const status = await apiClient.getPhaseStatus(projectId, 6, currentWorkflowId);
        if (cancelled) return;

        const pending = status.outputs?.pending_review as
          | { content?: string; description?: string; expectedOutputs?: string[] }
          | undefined;
        if (pending?.content) {
          setReviewContent(pending.content || '');
          setReviewDescription(pending.description || 'Please review the generated content.');
          setReviewExpectedOutputs(pending.expectedOutputs || []);
          setReviewInputs((prev) => {
            const next: Record<string, string> = { ...prev };
            for (const key of pending.expectedOutputs || []) {
              if (next[key] === undefined) next[key] = '';
            }
            return next;
          });
          setIsReviewDialogOpen(true);
        }

        if (status.status === 'completed') {
          const ch = runningChapterNumber ?? selectedChapterNumber;
          await refreshChapterArtifacts(ch, currentWorkflowStep);
          void refetchChapters();
          void refetchSelectedChapter();
          if (cancelled) return;
          setIsRunning(false);
          setCurrentWorkflowStep(null);
          setCurrentWorkflowId(null);
          setRunningChapterNumber(null);
        }

        if (status.status === 'failed') {
          setIsRunning(false);
          setCurrentWorkflowStep(null);
          setCurrentWorkflowId(null);
          setRunningChapterNumber(null);
        }
      } catch (error) {
        console.error('Failed to poll workflow status:', error);
      }
    };

    const interval = setInterval(poll, 3000);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    projectId,
    currentWorkflowId,
    refreshChapterArtifacts,
    refetchChapters,
    refetchSelectedChapter,
    runningChapterNumber,
    selectedChapterNumber,
    currentWorkflowStep,
  ]);

  function getArtifactType(name: string): Artifact['type'] {
    const n = name.toLowerCase();
    if (n.includes('outline')) return 'outline';
    if (n.includes('character')) return 'characters';
    if (n.includes('world')) return 'worldbuilding';
    if (n.includes('style')) return 'style';
    if (n.includes('chapter') || n.includes('scene') || n.includes('draft') || n.includes('final')) return 'chapter';
    return 'other';
  }

  // If opened without a projectId, auto-select the only project (if there is exactly one)
  useEffect(() => {
    if (projectId) return;
    if (!projects || projects.length !== 1) return;
    setSearchParams({ projectId: projects[0].id });
  }, [projectId, projects, setSearchParams]);

  // Load pinned/saved outputs from localStorage
  useEffect(() => {
    if (!projectId) return;

    try {
      const storedSaved = localStorage.getItem(`novel-weaver-saved-${projectId}`);
      if (storedSaved) {
        setSavedOutputs(JSON.parse(storedSaved));
      } else {
        setSavedOutputs({});
      }
    } catch (error) {
      console.error('Failed to load saved outputs from localStorage:', error);
      setSavedOutputs({});
    }
  }, [projectId]);

  // Fetch core continuity artifacts (best-effort)
  useEffect(() => {
    let cancelled = false;

    const loadCore = async () => {
      if (!projectId) return;
      const specs: Array<{ path: string; name: string }> = [
        { path: 'phase5_outputs/outline.md', name: 'Chapter Outline' },
        { path: 'phase4_outputs/characters.md', name: 'Character Profiles' },
        { path: 'phase4_outputs/worldbuilding.md', name: 'Worldbuilding' },
        { path: 'phase3_outputs/call_sheet.md', name: 'Call Sheet' },
        { path: 'phase2_outputs/series_outline.md', name: 'Series Outline' },
        { path: 'phase1_outputs/style_sheet.md', name: 'Style Sheet' },
        { path: 'phase1_outputs/context_bundle.md', name: 'Context Bundle' },
      ];

      const loaded: Artifact[] = [];
      for (const spec of specs) {
        try {
          const res = await apiClient.getArtifact(projectId, spec.path);
          loaded.push({
            id: `core:${spec.path}`,
            name: spec.name,
            type: getArtifactType(spec.name),
            content: res.content,
            updatedAt: new Date(),
            pinned: true,
          });
        } catch {
          // best-effort
        }
      }

      if (!cancelled) {
        setCoreArtifacts(loaded);
      }
    };

    loadCore();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Ensure a valid chapter is selected once chapters arrive
  useEffect(() => {
    if (!chaptersData || chaptersData.length === 0) return;
    const exists = chaptersData.some((c) => c.number === selectedChapterNumber);
    if (!exists) {
      setSelectedChapterNumber(chaptersData[0].number);
    }
  }, [chaptersData, selectedChapterNumber]);

  // Load the actual chapter artifacts for the selected chapter
  useEffect(() => {
    let cancelled = false;

    const loadChapterArtifacts = async () => {
      if (!projectId) return;

      setSceneBriefContent('');
      setDraftContent('');
      setImprovementPlanContent('');
      setFinalContent('');

      const chapterDir = `phase6_outputs/chapter_${selectedChapterNumber}`;

      if (selectedChapterData?.hasSceneBrief) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/scene_brief.md`);
          if (!cancelled) setSceneBriefContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (selectedChapterData?.hasFirstDraft) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/first_draft.md`);
          if (!cancelled) setDraftContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (selectedChapterData?.hasFinal) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/final.md`);
          if (!cancelled) setFinalContent(res.content);
        } catch {
          // best-effort
        }
      }

      if (selectedChapterData?.hasImprovementPlan) {
        try {
          const res = await apiClient.getArtifact(projectId, `${chapterDir}/improvement_plan.md`);
          if (!cancelled) setImprovementPlanContent(res.content);
        } catch {
          // best-effort
        }
      }
      
      // Load previous chapter final content for continuity
      if (selectedChapterNumber > 1) {
        const prevChapter = chaptersData?.find(ch => ch.number === selectedChapterNumber - 1);
        if (prevChapter?.hasFinal) {
          try {
            const prevChapterDir = `phase6_outputs/chapter_${selectedChapterNumber - 1}`;
            const res = await apiClient.getArtifact(projectId, `${prevChapterDir}/final.md`);
            if (!cancelled) setPreviousChapterContent(res.content);
          } catch {
            setPreviousChapterContent('');
          }
        } else {
          setPreviousChapterContent('');
        }
      } else {
        setPreviousChapterContent('');
      }
    };

    loadChapterArtifacts();
    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    selectedChapterNumber,
    selectedChapterData?.hasFinal,
    selectedChapterData?.hasFirstDraft,
    selectedChapterData?.hasSceneBrief,
    selectedChapterData?.hasImprovementPlan,
    chaptersData,
  ]);

  // Convert backend chapter data to frontend format
  const chapters: Chapter[] = (chaptersData || []).map(ch => ({
    id: ch.number.toString(),
    number: ch.number,
    title: ch.title,
    wordCount: ch.wordCount || 0,
    sceneBrief: ch.hasSceneBrief ? 'completed' : 'not-started',
    draft: ch.hasFirstDraft ? 'completed' : 'not-started',
    improvePlan: ch.hasImprovementPlan ? 'completed' : 'not-started',
    final: ch.hasFinal ? 'completed' : 'not-started'
  }));

  const selectedChapter = chapters.find(c => c.number === selectedChapterNumber) || chapters[0];

  const pinnedArtifacts: Artifact[] = useMemo(() => {
    const fromSaved: Artifact[] = Object.entries(savedOutputs).map(([key, value]) => ({
      id: key,
      name: value.name,
      type: getArtifactType(value.name),
      content: value.content,
      updatedAt: new Date(),
      pinned: true,
    }));

    const merged = new Map<string, Artifact>();
    for (const a of coreArtifacts) merged.set(a.id, a);
    for (const a of fromSaved) merged.set(a.id, a);
    return Array.from(merged.values());
  }, [savedOutputs, coreArtifacts]);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Choose a Project</h2>
            <p className="text-muted-foreground mb-4">Select a project to load its outline and chapters.</p>

            {projectsLoading ? (
              <p className="text-muted-foreground">Loading projects…</p>
            ) : (
              <div className="max-w-sm mx-auto text-left space-y-2">
                <Label>Project</Label>
                <Select
                  value={projectId || undefined}
                  onValueChange={(val) => setSearchParams({ projectId: val })}
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

  if (chaptersLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Loading Chapters…</h2>
            <p className="text-muted-foreground">Fetching chapter outline and progress.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Early return if no chapters available
  if (!selectedChapter) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Chapters Available</h2>
            <p className="text-muted-foreground">Complete Phase 5 to generate your chapter outline first.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const chapterContent = {
    sceneBrief: sceneBriefContent,
    draft: draftContent,
    improvePlan: improvementPlanContent,
    final: finalContent,
  };

  const handleSaveArtifact = async (tab: string, content: string) => {
    if (!projectId) return;

    const chapterDir = `phase6_outputs/chapter_${selectedChapterNumber}`;
    let artifactPath = '';

    switch (tab) {
      case 'scene-brief':
        artifactPath = `${chapterDir}/scene_brief.md`;
        setSceneBriefContent(content);
        break;
      case 'draft':
        artifactPath = `${chapterDir}/first_draft.md`;
        setDraftContent(content);
        break;
      case 'improve-plan':
        artifactPath = `${chapterDir}/improvement_plan.md`;
        setImprovementPlanContent(content);
        break;
      case 'final':
        artifactPath = `${chapterDir}/final.md`;
        setFinalContent(content);
        break;
      default:
        return;
    }

    try {
      await apiClient.updateArtifact(projectId, artifactPath, { content });
      void refetchChapters();
      void refetchSelectedChapter();
    } catch (error) {
      console.error('Failed to save artifact:', error);
    }
  };

  const handleApproveArtifact = async (tab: string, content: string) => {
    await handleSaveArtifact(tab, content);
  };

  const handlePromoteToNext = async (_fromTab: string) => {
    // Promotion is handled in the EditorTabs UI (tab navigation).
  };

  const handleSaveAsFinal = async (content: string) => {
    if (!projectId) return;

    const chapterDir = `phase6_outputs/chapter_${selectedChapterNumber}`;
    const artifactPath = `${chapterDir}/final.md`;

    try {
      await apiClient.updateArtifact(projectId, artifactPath, { content });
      setFinalContent(content);
      void refetchChapters();
      void refetchSelectedChapter();

      if (chapters.length > 0 && selectedChapterNumber < chapters.length) {
        setIsNextChapterDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to save final chapter:', error);
    }
  };

  const handleGenerateStep = async (step: string) => {
    if (!projectId) return;

    setIsRunning(true);
    setCurrentWorkflowStep(step);
    setRunningChapterNumber(selectedChapterNumber);

    try {
      const result = await apiClient.executePhase(projectId, 6, {
        phase: 6,
        inputs: {
          chapter_number: selectedChapterNumber,
          chapter_title: selectedChapter?.title || '',
          step: step,
          target_word_count: targetWordCount[0],
          tone: selectedTone,
          previous_chapter: previousChapterContent || 'NONE',
        },
      });
      setCurrentWorkflowId(result.workflowId);
    } catch (error) {
      console.error('Failed to generate step:', error);
      setIsRunning(false);
      setCurrentWorkflowStep(null);
      setCurrentWorkflowId(null);
      setRunningChapterNumber(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!currentWorkflowId) return;
    try {
      await apiClient.respondToWorkflow(currentWorkflowId, { inputs: reviewInputs });
      setIsReviewDialogOpen(false);
    } catch (error) {
      console.error('Failed to submit review response:', error);
    }
  };

  const completedChapters = chapters.filter(c => c.final === 'completed').length;
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <AppLayout>
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review</DialogTitle>
            <DialogDescription>{reviewDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={reviewContent}
              readOnly
              className="min-h-[240px] font-mono text-sm bg-muted/30 border-border"
            />

            {reviewExpectedOutputs.map((key) => (
              <div key={key} className="space-y-2">
                <Label>{key}</Label>
                <Textarea
                  value={reviewInputs[key] || ''}
                  onChange={(e) => setReviewInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="min-h-[80px] bg-muted/30 border-border"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSubmitReview} disabled={!currentWorkflowId}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNextChapterDialogOpen} onOpenChange={setIsNextChapterDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Final saved</DialogTitle>
            <DialogDescription>
              Move to the next chapter?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNextChapterDialogOpen(false)}>
              Stay
            </Button>
            <Button
              onClick={() => {
                setIsNextChapterDialogOpen(false);
                if (selectedChapterNumber < chapters.length) {
                  setSelectedChapterNumber(selectedChapterNumber + 1);
                }
              }}
              disabled={selectedChapterNumber >= chapters.length}
            >
              Next chapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left - Chapter list */}
        <CollapsiblePanel
          title="Chapters"
          icon={<List className="w-4 h-4" />}
          isOpen={isChaptersOpen}
          onToggle={toggleChaptersOpen}
          side="left"
        >
          <div className="p-3 lg:p-4 border-b border-border">
            <div className="flex items-center gap-3 lg:gap-4 text-xs lg:text-sm text-muted-foreground">
              <span>{completedChapters}/{chapters.length} complete</span>
              <span>{totalWords.toLocaleString()} words</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-1.5 lg:space-y-2 max-h-[calc(100vh-12rem)]">
            {chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                isActive={selectedChapter.id === chapter.id}
                onClick={() => setSelectedChapterNumber(chapter.number)}
                onContinue={() => setSelectedChapterNumber(chapter.number)}
              />
            ))}
          </div>
        </CollapsiblePanel>

        {/* Center - Editor workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
          {/* Chapter header */}
          <div className="p-3 lg:p-4 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 lg:gap-4 min-w-0">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const idx = chapters.findIndex(c => c.id === selectedChapter?.id);
                    if (idx > 0) setSelectedChapterNumber(chapters[idx - 1].number);
                  }}
                  disabled={!chapters.length || chapters[0]?.id === selectedChapter?.id}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const idx = chapters.findIndex(c => c.id === selectedChapter?.id);
                    if (idx < chapters.length - 1) setSelectedChapterNumber(chapters[idx + 1].number);
                  }}
                  disabled={!chapters.length || chapters[chapters.length - 1]?.id === selectedChapter?.id}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base lg:text-xl font-semibold truncate">
                  Chapter {selectedChapter.number}: {selectedChapter.title}
                </h3>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  {selectedChapter.wordCount.toLocaleString()} words
                </p>
              </div>
            </div>
            <Badge variant={selectedChapter.final === 'completed' ? 'success' : 'info'} className="shrink-0">
              {selectedChapter.final === 'completed' ? 'Complete' : 'In Progress'}
            </Badge>
          </div>

          {/* Editor tabs */}
          <div className="flex-1 overflow-hidden min-h-0 h-full flex flex-col">
            <EditorTabs
              sceneBrief={chapterContent.sceneBrief}
              draft={chapterContent.draft}
              improvePlan={chapterContent.improvePlan}
              final={chapterContent.final}
              onSave={handleSaveArtifact}
              onApprove={handleApproveArtifact}
              onPromoteToNext={handlePromoteToNext}
              onSaveAsFinal={handleSaveAsFinal}
              onGenerateStep={handleGenerateStep}
              projectId={projectId}
              chapterNumber={selectedChapterNumber}
              isGenerating={isRunning}
            />
          </div>
        </div>

        {/* Right - Controls panel */}
        <CollapsiblePanel
          title="Controls"
          icon={<Settings className="w-4 h-4" />}
          isOpen={isControlsOpen}
          onToggle={toggleControlsOpen}
          side="right"
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-6 max-h-[calc(100vh-8rem)]">
            {/* Previous chapter preview */}
            {selectedChapter.number > 1 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  Previous Chapter
                </Label>
                <div className="glass-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      Ch. {selectedChapter.number - 1}: {chapters[selectedChapter.number - 2]?.title}
                    </span>
                  </div>
                  {previousChapterContent ? (
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {previousChapterContent.slice(0, 200)}...
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Previous chapter not yet completed
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {selectedChapter.number === 1 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  Starting Point
                </Label>
                <div className="glass-card p-3">
                  <p className="text-xs text-muted-foreground">
                    This is Chapter 1. No previous chapter context needed.
                  </p>
                </div>
              </div>
            )}

            {/* Pinned artifacts */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Quick Reference
              </Label>
              <div className="space-y-2">
                {pinnedArtifacts.slice(0, 4).map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
                ))}
              </div>
            </div>

            {/* Settings */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                Generation Settings
              </Label>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Target Word Count</Label>
                    <span className="text-sm font-medium text-primary">
                      {targetWordCount[0].toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={targetWordCount}
                    onValueChange={setTargetWordCount}
                    min={1000}
                    max={6000}
                    step={500}
                    className="[&_[role=slider]]:bg-primary"
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Tone</Label>
                  <Select value={selectedTone} onValueChange={setSelectedTone}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {tones.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>
                          {tone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Workflow Status */}
            <div className="pt-4 border-t border-border">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                Workflow Progress
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {sceneBriefContent ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted" />
                  )}
                  <span className={sceneBriefContent ? 'text-foreground' : 'text-muted-foreground'}>
                    Scene Brief
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {draftContent ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted" />
                  )}
                  <span className={draftContent ? 'text-foreground' : 'text-muted-foreground'}>
                    First Draft
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {improvementPlanContent ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted" />
                  )}
                  <span className={improvementPlanContent ? 'text-foreground' : 'text-muted-foreground'}>
                    Improvement Plan
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {finalContent ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted" />
                  )}
                  <span className={finalContent ? 'text-foreground' : 'text-muted-foreground'}>
                    Final Version
                  </span>
                </div>
              </div>
              
              <div className="mt-4 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Use the editor to generate, review, and approve each step. The workflow guides you through the process.
                </p>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
    </AppLayout>
  );
}
