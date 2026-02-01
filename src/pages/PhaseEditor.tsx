import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { MarkdownEditor } from '@/components/shared/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePanelState } from '@/hooks/usePanelState';
import { useCockpitStorage } from '@/hooks/useCockpitStorage';
import { useArtifact, useArtifacts, useProject, useProjectProgress, useUpdateArtifact } from '@/api/hooks';
import type { Artifact } from '@/lib/mockData';
import { 
  ArrowLeft,
  Layers,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function PhaseEditor() {
  const { phaseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentPhaseId = parseInt(phaseId || '1');

  const projectId = searchParams.get('projectId') || searchParams.get('project') || undefined;

  const phaseInfo = useMemo(() => {
    const info: Record<number, { name: string; description: string; duration: string; outputs: string[] }> = {
      1: {
        name: 'Initial Setup & Research',
        description: 'Analyze genre tropes and establish your writing style sheet.',
        duration: '5-10 minutes',
        outputs: ['genre_tropes.md', 'style_sheet.md', 'context_bundle.md'],
      },
      2: {
        name: 'Brainstorming & Series Outline',
        description: 'Interactive brainstorming session to develop your series outline.',
        duration: '15-30 minutes',
        outputs: ['series_outline.md'],
      },
      3: {
        name: 'Call Sheet Generation',
        description: 'Generate a comprehensive call sheet for your novel production.',
        duration: '5-10 minutes',
        outputs: ['call_sheet.md'],
      },
      4: {
        name: 'Characters & Worldbuilding',
        description: 'Develop deep character profiles and rich world details.',
        duration: '10-20 minutes',
        outputs: ['characters.md', 'worldbuilding.md'],
      },
      5: {
        name: 'Story Bible Compilation',
        description: 'Compile a cohesive story bible for consistent drafting across the book/series.',
        duration: '10-20 minutes',
        outputs: ['story_bible.md'],
      },
      6: {
        name: 'Chapter Outline Creation',
        description: 'Create detailed chapter-by-chapter outline for your novel.',
        duration: '10-15 minutes',
        outputs: ['outline.md'],
      },
    };
    return info;
  }, []);

  const phaseIds = useMemo(() => [1, 2, 3, 4, 5, 6], []);
  const safePhaseId = phaseIds.includes(currentPhaseId) ? currentPhaseId : 1;

  const { data: project } = useProject(projectId);
  const { data: progress } = useProjectProgress(projectId);

  const currentPhaseMeta = phaseInfo[safePhaseId];
  const currentPhaseStatus = progress?.phases.find((p) => p.phase === safePhaseId)?.status || 'not-started';

  const [isPhasesOpen, togglePhasesOpen] = usePanelState('phase-editor-phases', true, projectId);
  const [isContextOpen, toggleContextOpen] = usePanelState('phase-editor-context', true, projectId);

  const phaseDir = `phase${safePhaseId}_outputs`;
  const { data: phaseArtifacts = [], isLoading: isArtifactsLoading } = useArtifacts(projectId, phaseDir);
  const sortedPhaseArtifacts = useMemo(() => {
    const list = phaseArtifacts.slice();
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [phaseArtifacts]);

  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSelectedArtifactPath(undefined);
  }, [safePhaseId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (sortedPhaseArtifacts.length === 0) return;
    setSelectedArtifactPath((prev) => prev || sortedPhaseArtifacts[0].path);
  }, [projectId, sortedPhaseArtifacts]);

  const {
    data: artifactData,
    isLoading: isArtifactLoading,
    error: artifactError,
    refetch: refetchArtifact,
  } = useArtifact(projectId, selectedArtifactPath);

  const [content, setContent] = useState('');
  const [lastSavedContent, setLastSavedContent] = useState('');

  const isDirty = content !== lastSavedContent;

  useEffect(() => {
    const artifactContent = artifactData?.content;
    if (artifactContent === undefined) return;
    setContent(artifactContent);
    setLastSavedContent(artifactContent);
  }, [artifactData?.path, artifactData?.content]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }, [isDirty]);

  const navigateWithGuard = useCallback((to: string) => {
    if (!confirmDiscardChanges()) return;
    navigate(to);
  }, [confirmDiscardChanges, navigate]);

  const selectArtifactWithGuard = useCallback((artifactPath: string) => {
    if (!confirmDiscardChanges()) return;
    setSelectedArtifactPath(artifactPath);
  }, [confirmDiscardChanges]);

  const updateArtifactMutation = useUpdateArtifact();
  const isSaving = updateArtifactMutation.isPending;
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleSave = useCallback(async () => {
    if (!projectId || !selectedArtifactPath) return;
    try {
      await updateArtifactMutation.mutateAsync({
        projectId,
        artifactPath: selectedArtifactPath,
        content,
      });
      setLastSavedContent(content);
      toast.success('Changes saved successfully');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save changes');
    }
  }, [projectId, selectedArtifactPath, content, updateArtifactMutation]);

  const handleRegenerate = useCallback(async () => {
    if (!projectId || !selectedArtifactPath) return;
    setIsRegenerating(true);
    try {
      const res = await refetchArtifact();
      if (res.data?.content !== undefined) {
        setContent(res.data.content);
        setLastSavedContent(res.data.content);
      }
      toast.success('Reloaded from project files');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reload');
    } finally {
      setIsRegenerating(false);
    }
  }, [projectId, selectedArtifactPath, refetchArtifact]);

  const { savedOutputs } = useCockpitStorage(projectId);
  const pinnedArtifacts: Artifact[] = useMemo(() => {
    return Object.entries(savedOutputs).map(([id, value]) => {
      const type =
        value.type?.includes('outline') ? 'outline' :
        value.type?.includes('character') ? 'characters' :
        value.type?.includes('world') ? 'worldbuilding' :
        value.type?.includes('style') ? 'style' :
        value.type?.includes('chapter') ? 'chapter' :
        'other';

      return {
        id: `saved:${id}`,
        name: value.name,
        type,
        content: value.content,
        updatedAt: new Date(),
        pinned: true,
      };
    });
  }, [savedOutputs]);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left - Phases panel */}
        <CollapsiblePanel
          title="Phases"
          icon={<Layers className="w-4 h-4" />}
          isOpen={isPhasesOpen}
          onToggle={togglePhasesOpen}
          side="left"
        >
          <div className="p-3 lg:p-4">
            <div className="mb-4 lg:mb-6">
              <h2 className="font-display text-base lg:text-lg font-semibold mb-1">{project?.title || 'Project'}</h2>
              <p className="text-xs lg:text-sm text-muted-foreground">{project?.genre || 'Fiction'} • {project?.seriesLength ?? 0} chapters</p>
            </div>

            <div className="space-y-1">
              {phaseIds.map((pid) => {
                const meta = phaseInfo[pid];
                const status = progress?.phases.find((p) => p.phase === pid)?.status || 'not-started';
                return (
                  <button
                    key={pid}
                    onClick={() => navigateWithGuard(`/phase-editor/${pid}${projectId ? `?projectId=${projectId}` : ''}`)}
                    className={cn(
                      "w-full text-left p-2 lg:p-3 rounded-lg transition-all",
                      pid === safePhaseId
                        ? "bg-primary/20 border border-primary/50"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className={cn(
                        "w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                        status === 'completed' ? "bg-status-success text-white" :
                        status === 'in-progress' ? "bg-primary text-white" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                        ) : (
                          pid
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs lg:text-sm font-medium truncate",
                          pid === safePhaseId ? "text-primary" : "text-foreground"
                        )}>
                          {meta?.name || `Phase ${pid}`}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 lg:mt-6 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => navigateWithGuard(projectId ? `/cockpit?project=${projectId}` : '/cockpit')}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Cockpit
              </Button>
            </div>
          </div>
        </CollapsiblePanel>

        {/* Center - Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 lg:p-4 border-b border-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground mb-1">
                <span>Phase {safePhaseId}</span>
                {selectedArtifactPath ? <span className="hidden sm:inline">•</span> : null}
                {selectedArtifactPath ? <span className="hidden sm:inline truncate">{selectedArtifactPath}</span> : null}
              </div>
              <h1 className="font-display text-base lg:text-xl font-semibold truncate">
                {currentPhaseMeta?.name || `Phase ${safePhaseId}`}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isDirty ? (
                <Badge variant="warning" className="hidden sm:inline-flex">
                  Unsaved
                </Badge>
              ) : null}
              <Badge variant={
                currentPhaseStatus === 'completed' ? 'success' :
                currentPhaseStatus === 'in-progress' ? 'info' : 'muted'
              }>
                {currentPhaseStatus === 'completed' ? 'Completed' :
                 currentPhaseStatus === 'in-progress' ? 'In Progress' : 'Not Started'}
              </Badge>
            </div>
          </div>

          <div className="px-3 lg:px-4 py-3 border-b border-border bg-muted/10">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <select
                  value={selectedArtifactPath || ''}
                  onChange={(e) => selectArtifactWithGuard(e.target.value)}
                  disabled={!projectId || isArtifactsLoading || sortedPhaseArtifacts.length === 0}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select a file
                  </option>
                  {sortedPhaseArtifacts.map((a) => (
                    <option key={a.path} value={a.path}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={!projectId || !selectedArtifactPath || isArtifactLoading}
                >
                  <RefreshCw className={cn("w-4 h-4", isRegenerating && "animate-spin")} />
                  <span className="hidden md:inline">Reload</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{currentPhaseMeta?.description}</p>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 p-2 lg:p-4 overflow-hidden">
            {!projectId ? (
              <div className="h-full flex items-center justify-center">
                <div className="glass-card p-6 max-w-lg w-full text-center">
                  <AlertCircle className="w-8 h-8 text-status-warning mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No project selected. Return to the cockpit and open the editor again.</p>
                  <div className="mt-4 flex justify-center">
                    <Button onClick={() => navigateWithGuard('/cockpit')}>Back to Cockpit</Button>
                  </div>
                </div>
              </div>
            ) : isArtifactsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading phase files...</div>
              </div>
            ) : sortedPhaseArtifacts.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="glass-card p-6 max-w-lg w-full text-center">
                  <FileText className="w-8 h-8 text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No phase outputs found yet. Run this phase in the Workflow cockpit to generate outputs.</p>
                  <div className="mt-4 flex justify-center">
                    <Button onClick={() => navigateWithGuard(`/cockpit?project=${projectId}`)}>Go to Workflow Cockpit</Button>
                  </div>
                </div>
              </div>
            ) : isArtifactLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading file...</div>
              </div>
            ) : artifactError ? (
              <div className="h-full flex items-center justify-center">
                <div className="glass-card p-6 max-w-lg w-full text-center">
                  <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{artifactError instanceof Error ? artifactError.message : 'Failed to load file'}</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="outline" onClick={handleRegenerate}>Reload</Button>
                    <Button onClick={() => navigateWithGuard(`/cockpit?project=${projectId}`)}>Back to Cockpit</Button>
                  </div>
                </div>
              </div>
            ) : (
              <MarkdownEditor
                value={content}
                onChange={setContent}
                onSave={handleSave}
                isSaving={isSaving}
                placeholder="Start writing your phase content..."
              />
            )}
          </div>

          {/* Footer actions */}
          <div className="p-3 lg:p-4 border-t border-border flex items-center justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRegenerate}
              disabled={!projectId || !selectedArtifactPath || isRegenerating}
            >
              <RefreshCw className={cn("w-4 h-4", isRegenerating && "animate-spin")} />
              <span className="hidden sm:inline">{isRegenerating ? 'Reloading...' : 'Reload'}</span>
            </Button>
          </div>
        </div>

        {/* Right - Context panel */}
        <CollapsiblePanel
          title="Context"
          icon={<FileText className="w-4 h-4" />}
          isOpen={isContextOpen}
          onToggle={toggleContextOpen}
          side="right"
        >
          <div className="p-3 lg:p-4 space-y-4 lg:space-y-6">
            {/* Phase outputs */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Expected Outputs
              </span>
              <div className="mt-2 lg:mt-3 space-y-1.5 lg:space-y-2">
                {(currentPhaseMeta?.outputs || []).map((output) => (
                  <div key={output} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary shrink-0" />
                    <span className="text-xs lg:text-sm truncate">{output}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pinned artifacts */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reference Artifacts
              </span>
              <div className="mt-2 lg:mt-3 space-y-1.5 lg:space-y-2">
                {pinnedArtifacts.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Pin artifacts in the Workflow cockpit to reference them here.
                  </div>
                ) : (
                  pinnedArtifacts.map((artifact) => (
                    <ArtifactCard
                      key={artifact.id}
                      artifact={artifact}
                      compact
                      onCopy={() => {
                        if (artifact.content) {
                          navigator.clipboard.writeText(artifact.content);
                          toast.success('Copied to clipboard');
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
    </AppLayout>
  );
}
