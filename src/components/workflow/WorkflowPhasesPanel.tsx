import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { PhaseTimeline } from '@/components/shared/PhaseTimeline';
import type { Phase } from '@/lib/mockData';
import { Layers } from 'lucide-react';

interface WorkflowPhasesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  projectTitle: string;
  projectGenre: string;
  totalChapters: number;
  phases: Phase[];
  currentPhase: number;
  onPhaseClick: (phaseId: number) => void;
}

export function WorkflowPhasesPanel({
  isOpen,
  onToggle,
  projectTitle,
  projectGenre,
  totalChapters,
  phases,
  currentPhase,
  onPhaseClick,
}: WorkflowPhasesPanelProps) {
  return (
    <CollapsiblePanel
      title="Phases"
      icon={<Layers className="w-4 h-4" />}
      isOpen={isOpen}
      onToggle={onToggle}
      side="left"
    >
      <div className="p-4">
        <div className="mb-6">
          <h2 className="font-display text-base lg:text-lg font-semibold mb-1">{projectTitle}</h2>
          <p className="text-xs lg:text-sm text-muted-foreground">
            {projectGenre} • {totalChapters} chapters
          </p>
        </div>

        <div className="mb-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflow Phases</span>
        </div>

        <PhaseTimeline phases={phases} currentPhase={currentPhase} onPhaseClick={(phase) => onPhaseClick(phase.id)} />
      </div>
    </CollapsiblePanel>
  );
}
