import { Project } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Calendar, BookOpen, MoreVertical, Archive, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  isArchived?: boolean;
  onArchiveToggle?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onClick, isArchived, onArchiveToggle, onDelete }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-card-hover p-6 cursor-pointer group",
        isArchived && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-secondary/30 transition-all">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          {isArchived && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              Archived
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
            Phase {project.currentPhase}/7
          </span>

          {(onArchiveToggle || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onArchiveToggle && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveToggle();
                    }}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isArchived ? 'Unarchive' : 'Archive'}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Title & Author */}
      <h3 className="font-display text-xl font-semibold mb-1 text-foreground group-hover:gradient-text transition-all">
        {project.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        by {project.author}
      </p>

      {/* Genre & Chapters */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span className="inline-flex items-center gap-1.5 bg-secondary/10 text-secondary px-2 py-1 rounded-full">
          {project.genre}
        </span>
        <span>{project.seriesLength} chapters</span>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-primary">{Number(project.progress || 0).toFixed(1)}%</span>
        </div>
        <Progress value={project.progress} className="h-2 bg-muted" />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}
