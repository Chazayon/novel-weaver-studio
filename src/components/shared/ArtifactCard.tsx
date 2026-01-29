import { Artifact } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Globe,
  Palette,
  BookOpen,
  Pin,
  Copy,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface ArtifactCardProps {
  artifact: Artifact;
  compact?: boolean;
  onOpen?: () => void;
  onCopy?: () => void;
  onTogglePin?: () => void;
}

const typeConfig = {
  outline: { icon: FileText, color: 'text-primary' },
  characters: { icon: Users, color: 'text-violet-400' },
  worldbuilding: { icon: Globe, color: 'text-emerald-400' },
  style: { icon: Palette, color: 'text-amber-400' },
  chapter: { icon: BookOpen, color: 'text-rose-400' },
  other: { icon: FileText, color: 'text-muted-foreground' },
};

export function ArtifactCard({ artifact, compact, onOpen, onCopy, onTogglePin }: ArtifactCardProps) {
  const config = typeConfig[artifact.type];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
        <div className={cn("w-8 h-8 rounded-lg bg-background flex items-center justify-center", config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{artifact.name}</h4>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpen}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
        {artifact.pinned && (
          <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div className="glass-card-hover p-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0",
          config.color
        )}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{artifact.name}</h4>
            {artifact.pinned && (
              <Pin className="w-3 h-3 text-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {artifact.updatedAt && !isNaN(new Date(artifact.updatedAt).getTime())
              ? `Updated ${formatDistanceToNow(new Date(artifact.updatedAt), { addSuffix: true })}`
              : 'Recently updated'}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-card border-border">
            <DropdownMenuItem onClick={onOpen}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePin}>
              <Pin className="w-4 h-4 mr-2" />
              {artifact.pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono line-clamp-3">
        {artifact.content.substring(0, 150)}...
      </div>
    </div>
  );
}
