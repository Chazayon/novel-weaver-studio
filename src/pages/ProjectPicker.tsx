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
import { useProjects, useCreateProject, useDeleteProject } from '@/api/hooks';
import { Plus, Search, BookOpen, ArrowUpDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const deleteProjectMutation = useDeleteProject();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'progress'>('recent');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
                      disabled={!newProject.title || !newProject.genre || createProjectMutation.isPending}
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
