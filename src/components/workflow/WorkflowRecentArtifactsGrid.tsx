import { ArtifactCard } from '@/components/shared/ArtifactCard';
import type { Artifact } from '@/lib/mockData';
import { Sparkles } from 'lucide-react';

interface WorkflowRecentArtifactsGridProps {
  artifacts: Artifact[];
  onOpenArtifact: (artifact: Artifact) => void;
  onTogglePin: (artifact: Artifact) => void;
}

export function WorkflowRecentArtifactsGrid({
  artifacts,
  onOpenArtifact,
  onTogglePin,
}: WorkflowRecentArtifactsGridProps) {
  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-base lg:text-lg font-display font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Recent Artifacts
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Quick access to the latest outputs (open, copy, or pin to context).
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {artifacts.slice(0, 3).map((artifact, index) => (
          <div
            key={artifact.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <ArtifactCard
              artifact={artifact}
              onOpen={() => onOpenArtifact(artifact)}
              onTogglePin={() => onTogglePin(artifact)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
