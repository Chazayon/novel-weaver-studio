import { ChevronRight } from 'lucide-react';

interface WorkflowPhaseHeaderProps {
  phaseId: number;
  phaseName: string;
  description: string;
}

export function WorkflowPhaseHeader({ phaseId, phaseName, description }: WorkflowPhaseHeaderProps) {
  return (
    <div className="mb-6 lg:mb-8">
      <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground mb-2">
        <span>Phase {phaseId}</span>
        <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
        <span className="text-foreground">{phaseName}</span>
      </div>
      <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold gradient-text mb-2">{phaseName}</h1>
      <p className="text-sm lg:text-base text-muted-foreground max-w-2xl">{description}</p>
    </div>
  );
}
