import { useEffect, useMemo, useState } from 'react';
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
  Settings
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

  // Core continuity artifacts (outline / characters / worldbuilding / etc.)
  const [coreArtifacts, setCoreArtifacts] = useState<Artifact[]>([]);

  // API hooks
  const { data: chaptersData, isLoading: chaptersLoading } = useChapters(projectId || undefined);

  const [selectedChapterNumber, setSelectedChapterNumber] = useState(1);
  const { data: selectedChapterData } = useChapter(projectId || undefined, selectedChapterNumber);

  const [targetWordCount, setTargetWordCount] = useState([3000]);
  const [selectedTone, setSelectedTone] = useState('neutral');
  const [isRunning, setIsRunning] = useState(false);
  const [isChaptersOpen, toggleChaptersOpen] = usePanelState('chapter-studio-chapters', true);
  const [isControlsOpen, toggleControlsOpen] = usePanelState('chapter-studio-controls', true);

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

      try {
        const res = await apiClient.getArtifact(projectId, `${chapterDir}/improvement_plan.md`);
        if (!cancelled) setImprovementPlanContent(res.content);
      } catch {
        // best-effort
      }
    };

    loadChapterArtifacts();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedChapterNumber, selectedChapterData?.hasFinal, selectedChapterData?.hasFirstDraft, selectedChapterData?.hasSceneBrief]);

  // Convert backend chapter data to frontend format
  const chapters: Chapter[] = (chaptersData || []).map(ch => ({
    id: ch.number.toString(),
    number: ch.number,
    title: ch.title,
    wordCount: ch.wordCount || 0,
    sceneBrief: ch.hasSceneBrief ? 'completed' : 'not-started',
    draft: ch.hasFirstDraft ? 'completed' : 'not-started',
    improvePlan: 'not-started' as const,
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

  const handleRunStep = (step: string) => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  };

  const completedChapters = chapters.filter(c => c.final === 'completed').length;
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          <div className="flex-1 p-2 lg:p-4 overflow-hidden">
            <EditorTabs
              sceneBrief={chapterContent.sceneBrief}
              draft={chapterContent.draft}
              improvePlan={chapterContent.improvePlan}
              final={chapterContent.final}
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
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    The previous chapter ended with Elena discovering the hidden message in the ancient tome...
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

            {/* Run buttons */}
            <div className="space-y-2 pt-4 border-t border-border">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => handleRunStep('scene-brief')}
                disabled={isRunning || selectedChapter.sceneBrief === 'completed'}
              >
                <FileText className="w-4 h-4" />
                Generate Scene Brief
                {selectedChapter.sceneBrief === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                )}
              </Button>

              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => handleRunStep('draft')}
                disabled={isRunning || selectedChapter.sceneBrief !== 'completed'}
              >
                <Sparkles className="w-4 h-4" />
                Draft Chapter
                {selectedChapter.draft === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                )}
              </Button>

              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => handleRunStep('improve')}
                disabled={isRunning || selectedChapter.draft !== 'completed'}
              >
                <Play className="w-4 h-4" />
                Analyze & Improve
                {selectedChapter.improvePlan === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                )}
              </Button>

              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => handleRunStep('final')}
                disabled={isRunning || selectedChapter.improvePlan !== 'completed'}
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply Improvements
                {selectedChapter.final === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                )}
              </Button>

              <div className="pt-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleRunStep('full')}
                  disabled={isRunning || selectedChapter.final === 'completed'}
                >
                  <Zap className="w-4 h-4" />
                  {isRunning ? 'Running...' : 'Run Full Pipeline'}
                </Button>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
    </AppLayout>
  );
}
