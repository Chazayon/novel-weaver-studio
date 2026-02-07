import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Project } from '@/lib/mockData';
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useCreateProjectFromImport,
} from '@/api/hooks';
import { apiClient } from '@/api/client';
import { Plus, Search, BookOpen, ArrowUpDown, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ImportDataState = {
  genreTropes: string;
  styleSheet: string;
  contextBundle: string;
  seriesOutline: string;
  callSheet: string;
  characters: string;
  worldbuilding: string;
  storyBible: string;
  outline: string;
  overwrite: boolean;
  ensureContextBundle: boolean;
  generateOutlineFromChapters: boolean;
};

type ResearchFieldKey = Exclude<
  keyof ImportDataState,
  'overwrite' | 'ensureContextBundle' | 'generateOutlineFromChapters'
>;

const genres = [
  'Fantasy',
  'Sci-Fi',
  'Romance',
  'Mystery',
  'Thriller',
  'Literary Fiction',
  'Horror',
  'Historical Fiction',
];

const ARCHIVED_PROJECTS_KEY = 'novel-weaver:archived-projects';

export default function ProjectPicker() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch projects from API
  const { data: apiProjects, isLoading, error } = useProjects();
  const createProjectMutation = useCreateProject();
  const createFromImportMutation = useCreateProjectFromImport();
  const deleteProjectMutation = useDeleteProject();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'progress'>('recent');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [archivedProjectIds, setArchivedProjectIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ARCHIVED_PROJECTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });
  const [newProject, setNewProject] = useState({
    title: '',
    author: '',
    genre: '',
    seriesLength: 20,
  });

  const [importProject, setImportProject] = useState({
    title: '',
    author: '',
    genre: '',
    seriesLength: 20,
  });

  const [importData, setImportData] = useState<ImportDataState>({
    genreTropes: '',
    styleSheet: '',
    contextBundle: '',
    seriesOutline: '',
    callSheet: '',
    characters: '',
    worldbuilding: '',
    storyBible: '',
    outline: '',
    overwrite: false,
    ensureContextBundle: true,
    generateOutlineFromChapters: true,
  });

  const [importChapters, setImportChapters] = useState<
    Array<{ number: number; title: string; kind: 'final' | 'draft'; content: string }>
  >([]);

  const [generateStyleSheet, setGenerateStyleSheet] = useState(false);
  const [overwriteGeneratedStyleSheet, setOverwriteGeneratedStyleSheet] = useState(false);
  const [styleSheetMaxChars, setStyleSheetMaxChars] = useState(60000);

  const readTextFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const applyFileToField = async (
    file: File | undefined,
    setter: (value: string) => void,
  ) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setter(text);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to read file',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVED_PROJECTS_KEY, JSON.stringify(archivedProjectIds));
    } catch {
      // ignore
    }
  }, [archivedProjectIds]);

  const archivedSet = useMemo(() => new Set(archivedProjectIds), [archivedProjectIds]);

  // Convert API projects to frontend format
  const projects: Project[] = (apiProjects || []).map(p => ({
    id: p.id,
    title: p.title,
    author: p.author,
    genre: p.genre,
    seriesLength: p.seriesLength,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    currentPhase: p.currentPhase,
    progress: p.progress,
  }));

  const toggleArchive = (projectId: string) => {
    setArchivedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProjectMutation.mutateAsync(deleteTarget.id);
      setArchivedProjectIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      toast({
        title: 'Project deleted',
        description: `"${deleteTarget.title}" has been deleted.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleCreateProjectFromImport = async () => {
    try {
      const chapters = importChapters
        .filter((c) => Number.isFinite(c.number) && c.number > 0 && c.content.trim())
        .map((c) => ({
          number: c.number,
          title: c.title?.trim() ? c.title.trim() : undefined,
          kind: c.kind,
          content: c.content,
        }));

      const payload = {
        metadata: {
          title: importProject.title,
          author: importProject.author,
          genre: importProject.genre,
          seriesLength: importProject.seriesLength,
        },
        import: {
          genreTropes: importData.genreTropes.trim() ? importData.genreTropes : undefined,
          styleSheet: importData.styleSheet.trim() ? importData.styleSheet : undefined,
          contextBundle: importData.contextBundle.trim() ? importData.contextBundle : undefined,
          seriesOutline: importData.seriesOutline.trim() ? importData.seriesOutline : undefined,
          callSheet: importData.callSheet.trim() ? importData.callSheet : undefined,
          characters: importData.characters.trim() ? importData.characters : undefined,
          worldbuilding: importData.worldbuilding.trim() ? importData.worldbuilding : undefined,
          storyBible: importData.storyBible.trim() ? importData.storyBible : undefined,
          outline: importData.outline.trim() ? importData.outline : undefined,
          chapters,
          overwrite: importData.overwrite,
          ensureContextBundle: importData.ensureContextBundle,
          generateOutlineFromChapters: importData.generateOutlineFromChapters,
        },
      };

      const project = await createFromImportMutation.mutateAsync(payload);

      if (generateStyleSheet && chapters.length > 0) {
        const chapterNumbers = chapters.map((c) => c.number).sort((a, b) => a - b);
        await apiClient.generateStyleSheetFromChapters(project.id, {
          overwrite: overwriteGeneratedStyleSheet,
          maxChars: styleSheetMaxChars,
          chapterNumbers,
        });
      }

      setIsImportOpen(false);
      setImportProject({ title: '', author: '', genre: '', seriesLength: 20 });
      setImportData({
        genreTropes: '',
        styleSheet: '',
        contextBundle: '',
        seriesOutline: '',
        callSheet: '',
        characters: '',
        worldbuilding: '',
        storyBible: '',
        outline: '',
        overwrite: false,
        ensureContextBundle: true,
        generateOutlineFromChapters: true,
      });
      setImportChapters([]);
      setGenerateStyleSheet(false);
      setOverwriteGeneratedStyleSheet(false);
      setStyleSheetMaxChars(60000);

      toast({
        title: 'Project imported',
        description: `"${project.title}" has been created from your import.`,
      });

      navigate(`/cockpit?project=${project.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import project',
        variant: 'destructive',
      });
    }
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.genre.toLowerCase().includes(search.toLowerCase());
      const isArchived = archivedSet.has(p.id);
      return matchesSearch && (showArchived || !isArchived);
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      return b.progress - a.progress;
    });

  const handleCreateProject = async () => {
    try {
      const project = await createProjectMutation.mutateAsync(newProject);
      setIsCreateOpen(false);
      setNewProject({ title: '', author: '', genre: '', seriesLength: 20 });
      toast({
        title: 'Project created',
        description: `"${project.title}" has been created successfully.`,
      });
      navigate(`/cockpit?project=${project.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading projects...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive font-medium">Failed to load projects</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Only show content when loaded */}
        {!isLoading && (
          <>
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="font-display text-4xl font-bold mb-2">
                  <span className="gradient-text">Your Projects</span>
                </h1>
                <p className="text-muted-foreground">
                  Manage your novels and continue your writing journey
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" variant="outline" className="shrink-0">
                      <Upload className="w-5 h-5" />
                      Import Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl">Create Project From Import</DialogTitle>
                      <DialogDescription>
                        Upload or paste what you already have. After creation, run the missing phases.
                      </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="metadata" className="w-full">
                      <TabsList className="w-full justify-start">
                        <TabsTrigger value="metadata">Metadata</TabsTrigger>
                        <TabsTrigger value="research">Research</TabsTrigger>
                        <TabsTrigger value="chapters">Chapters</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                      </TabsList>

                      <TabsContent value="metadata">
                        <div className="grid gap-4 py-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="import-title">Title</Label>
                            <Input
                              id="import-title"
                              placeholder="The Forgotten Kingdom"
                              value={importProject.title}
                              onChange={(e) => setImportProject({ ...importProject, title: e.target.value })}
                              className="bg-muted/50 border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="import-author">Author</Label>
                            <Input
                              id="import-author"
                              placeholder="Your name"
                              value={importProject.author}
                              onChange={(e) => setImportProject({ ...importProject, author: e.target.value })}
                              className="bg-muted/50 border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="import-genre">Genre</Label>
                            <Select
                              value={importProject.genre}
                              onValueChange={(value) => setImportProject({ ...importProject, genre: value })}
                            >
                              <SelectTrigger className="bg-muted/50 border-border">
                                <SelectValue placeholder="Select a genre" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {genres.map((genre) => (
                                  <SelectItem key={genre} value={genre}>
                                    {genre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="import-chapters">Number of Chapters</Label>
                            <Input
                              id="import-chapters"
                              type="number"
                              min={1}
                              max={200}
                              value={importProject.seriesLength}
                              onChange={(e) =>
                                setImportProject({
                                  ...importProject,
                                  seriesLength: parseInt(e.target.value) || 20,
                                })
                              }
                              className="bg-muted/50 border-border"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="research">
                        <ScrollArea className="h-[420px] pr-3">
                          <div className="space-y-6 py-4">
                            {(
                              [
                                { key: 'genreTropes', label: 'Genre Tropes', accept: '.md,.txt' },
                                { key: 'styleSheet', label: 'Style Sheet', accept: '.md,.txt' },
                                { key: 'contextBundle', label: 'Context Bundle', accept: '.md,.txt' },
                                { key: 'seriesOutline', label: 'Series Outline', accept: '.md,.txt' },
                                { key: 'callSheet', label: 'Call Sheet', accept: '.md,.txt' },
                                { key: 'characters', label: 'Characters', accept: '.md,.txt' },
                                { key: 'worldbuilding', label: 'Worldbuilding', accept: '.md,.txt' },
                                { key: 'storyBible', label: 'Story Bible', accept: '.md,.txt' },
                                { key: 'outline', label: 'Outline', accept: '.md,.txt' },
                              ] as const satisfies ReadonlyArray<{
                                key: ResearchFieldKey;
                                label: string;
                                accept: string;
                              }>
                            ).map((field) => (
                              <div key={field.key} className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <Label>{field.label}</Label>
                                  <Input
                                    type="file"
                                    accept={field.accept}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      applyFileToField(file, (value) =>
                                        setImportData((prev) => ({ ...prev, [field.key]: value }))
                                      );
                                    }}
                                    className="max-w-[260px] bg-muted/50 border-border"
                                  />
                                </div>
                                <Textarea
                                  value={importData[field.key]}
                                  onChange={(e) =>
                                    setImportData((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  placeholder={`Paste ${field.label} here (optional)`}
                                  className="bg-muted/50 border-border min-h-[120px]"
                                />
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="chapters">
                        <div className="flex items-center justify-between py-4">
                          <div className="text-sm text-muted-foreground">
                            Add any chapters you already wrote. The app will suggest where to resume.
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setImportChapters((prev) => [
                                ...prev,
                                { number: prev.length + 1, title: '', kind: 'final', content: '' },
                              ])
                            }
                          >
                            <Plus className="w-4 h-4" />
                            Add Chapter
                          </Button>
                        </div>

                        <ScrollArea className="h-[420px] pr-3">
                          <div className="space-y-6 pb-4">
                            {importChapters.length === 0 && (
                              <div className="text-sm text-muted-foreground py-6">
                                No chapters added yet.
                              </div>
                            )}

                            {importChapters.map((ch, idx) => (
                              <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                                <div className="grid gap-3 md:grid-cols-4">
                                  <div className="space-y-2">
                                    <Label>Number</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={ch.number}
                                      onChange={(e) => {
                                        const num = parseInt(e.target.value) || 1;
                                        setImportChapters((prev) =>
                                          prev.map((c, i) => (i === idx ? { ...c, number: num } : c))
                                        );
                                      }}
                                      className="bg-muted/50 border-border"
                                    />
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Title (optional)</Label>
                                    <Input
                                      value={ch.title}
                                      onChange={(e) =>
                                        setImportChapters((prev) =>
                                          prev.map((c, i) =>
                                            i === idx ? { ...c, title: e.target.value } : c
                                          )
                                        )
                                      }
                                      className="bg-muted/50 border-border"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Kind</Label>
                                    <Select
                                      value={ch.kind}
                                      onValueChange={(value) => {
                                        const kind = value === 'draft' ? 'draft' : 'final';
                                        setImportChapters((prev) =>
                                          prev.map((c, i) => (i === idx ? { ...c, kind } : c))
                                        );
                                      }}
                                    >
                                      <SelectTrigger className="bg-muted/50 border-border">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-card border-border">
                                        <SelectItem value="final">Final</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                  <Label>Content</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      accept=".md,.txt"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        applyFileToField(file, (value) =>
                                          setImportChapters((prev) =>
                                            prev.map((c, i) =>
                                              i === idx ? { ...c, content: value } : c
                                            )
                                          )
                                        );
                                      }}
                                      className="max-w-[260px] bg-muted/50 border-border"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setImportChapters((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>

                                <Textarea
                                  value={ch.content}
                                  onChange={(e) =>
                                    setImportChapters((prev) =>
                                      prev.map((c, i) => (i === idx ? { ...c, content: e.target.value } : c))
                                    )
                                  }
                                  placeholder="Paste chapter text here"
                                  className="bg-muted/50 border-border min-h-[160px]"
                                />
                              </div>
                            ))}

                            <div className="rounded-lg border border-border p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={generateStyleSheet}
                                  onCheckedChange={(v) => setGenerateStyleSheet(Boolean(v))}
                                  disabled={importChapters.length === 0}
                                />
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">Generate style sheet from imported chapters</div>
                                  <div className="text-xs text-muted-foreground">
                                    Uses your existing writing to keep voice consistent for new chapters.
                                  </div>
                                </div>
                              </div>

                              {generateStyleSheet && (
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Max characters sampled</Label>
                                    <Input
                                      type="number"
                                      min={5000}
                                      max={200000}
                                      value={styleSheetMaxChars}
                                      onChange={(e) => setStyleSheetMaxChars(parseInt(e.target.value) || 60000)}
                                      className="bg-muted/50 border-border"
                                    />
                                  </div>
                                  <div className="flex items-center gap-3 pt-7">
                                    <Checkbox
                                      checked={overwriteGeneratedStyleSheet}
                                      onCheckedChange={(v) => setOverwriteGeneratedStyleSheet(Boolean(v))}
                                    />
                                    <Label>Overwrite existing style sheet</Label>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="advanced">
                        <div className="space-y-4 py-4">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={importData.overwrite}
                              onCheckedChange={(v) => setImportData((prev) => ({ ...prev, overwrite: Boolean(v) }))}
                            />
                            <Label>Overwrite existing artifacts if they already exist</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={importData.ensureContextBundle}
                              onCheckedChange={(v) =>
                                setImportData((prev) => ({ ...prev, ensureContextBundle: Boolean(v) }))
                              }
                            />
                            <Label>Ensure a context bundle exists (recommended)</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={importData.generateOutlineFromChapters}
                              onCheckedChange={(v) =>
                                setImportData((prev) => ({ ...prev, generateOutlineFromChapters: Boolean(v) }))
                              }
                            />
                            <Label>Generate a basic outline from imported chapters if no outline is provided</Label>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateProjectFromImport}
                        disabled={
                          !importProject.title ||
                          !importProject.author ||
                          !importProject.genre ||
                          createFromImportMutation.isPending
                        }
                        variant="glow"
                        className="glow-primary-strong"
                      >
                        {createFromImportMutation.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Create From Import
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 20px hsl(var(--primary) / 0.3)',
                          '0 0 35px hsl(var(--primary) / 0.5)',
                          '0 0 20px hsl(var(--primary) / 0.3)'
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Button size="lg" className="shrink-0">
                        <Plus className="w-5 h-5" />
                        Create New Project
                      </Button>
                    </motion.div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">Create New Project</DialogTitle>
                    <DialogDescription>
                      Start a new novel. You can always change these details later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        placeholder="The Forgotten Kingdom"
                        value={newProject.title}
                        onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        placeholder="Your name"
                        value={newProject.author}
                        onChange={(e) => setNewProject({ ...newProject, author: e.target.value })}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genre">Genre</Label>
                      <Select
                        value={newProject.genre}
                        onValueChange={(value) => setNewProject({ ...newProject, genre: value })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border">
                          <SelectValue placeholder="Select a genre" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {genres.map((genre) => (
                            <SelectItem key={genre} value={genre}>
                              {genre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chapters">Number of Chapters</Label>
                      <Input
                        id="chapters"
                        type="number"
                        min={1}
                        max={100}
                        value={newProject.seriesLength}
                        onChange={(e) =>
                          setNewProject({ ...newProject, seriesLength: parseInt(e.target.value) || 20 })
                        }
                        className="bg-muted/50 border-border"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      disabled={!newProject.title || !newProject.author || !newProject.genre || createProjectMutation.isPending}
                      variant="glow"
                      className="glow-primary-strong"
                    >
                      {createProjectMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Create Project
                    </Button>
                  </DialogFooter>
                </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Show archived</Label>
                <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[180px] bg-muted/50 border-border">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="progress">By Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Projects grid */}
            {filteredProjects.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <ProjectCard
                      project={project}
                      onClick={() => navigate(`/cockpit?project=${project.id}`)}
                      isArchived={archivedSet.has(project.id)}
                      onArchiveToggle={() => toggleArchive(project.id)}
                      onDelete={() => {
                        setDeleteTarget(project);
                        setIsDeleteOpen(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No projects yet"
                description="Create your first project to start your AI-assisted novel writing journey."
                action={{
                  label: 'Create New Project',
                  onClick: () => setIsCreateOpen(true),
                }}
              />
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget ? `"${deleteTarget.title}"` : 'this project'} and its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
