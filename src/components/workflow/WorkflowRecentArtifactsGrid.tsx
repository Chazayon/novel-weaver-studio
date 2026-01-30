import { ArtifactCard } from '@/components/shared/ArtifactCard';
import type { Artifact } from '@/lib/mockData';

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
      <h3 className="text-base lg:text-lg font-display font-semibold mb-4">Recent Artifacts</h3>
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
