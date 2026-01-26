import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockProjects, Project } from '@/lib/mockData';
import { Plus, Search, BookOpen, ArrowUpDown } from 'lucide-react';

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

export default function ProjectPicker() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'progress'>('recent');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    author: '',
    genre: '',
    seriesLength: 20,
  });

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.genre.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'recent') return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      return b.progress - a.progress;
    });

  const handleCreateProject = () => {
    const project: Project = {
      id: String(Date.now()),
      ...newProject,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentPhase: 1,
      progress: 0,
    };
    setProjects([project, ...projects]);
    setIsCreateOpen(false);
    setNewProject({ title: '', author: '', genre: '', seriesLength: 20 });
    navigate('/cockpit');
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
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
              <Button size="lg" className="shrink-0">
                <Plus className="w-5 h-5" />
                Create New Project
              </Button>
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
                  disabled={!newProject.title || !newProject.genre}
                >
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
                  onClick={() => navigate('/cockpit')}
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
      </div>
    </AppLayout>
  );
}
