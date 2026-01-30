import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import type { Artifact } from '@/lib/mockData';
import { Pin } from 'lucide-react';

interface WorkflowContextPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  savedArtifacts: Artifact[];
  artifacts: Artifact[];
  onOpenArtifact: (artifact: Artifact) => void;
  onTogglePin: (artifact: Artifact) => void;
}

export function WorkflowContextPanel({
  isOpen,
  onToggle,
  savedArtifacts,
  artifacts,
  onOpenArtifact,
  onTogglePin,
}: WorkflowContextPanelProps) {
  return (
    <CollapsiblePanel
      title="Context"
      icon={<Pin className="w-4 h-4" />}
      isOpen={isOpen}
      onToggle={onToggle}
      side="right"
    >
      <div className="p-4 space-y-6">
        {savedArtifacts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Pin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saved</span>
            </div>
            <div className="space-y-2">
              {savedArtifacts.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  compact
                  onOpen={() => onOpenArtifact(artifact)}
                  onTogglePin={() => onTogglePin(artifact)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All Artifacts</span>
          <div className="space-y-2 mt-3">
            {artifacts.filter((a) => !a.pinned).map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                compact
                onOpen={() => onOpenArtifact(artifact)}
                onTogglePin={() => onTogglePin(artifact)}
              />
            ))}
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
