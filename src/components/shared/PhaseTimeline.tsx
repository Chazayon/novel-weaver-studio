import { Phase } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface PhaseTimelineProps {
  phases: Phase[];
  currentPhase: number;
  onPhaseClick?: (phase: Phase) => void;
}

export function PhaseTimeline({ phases, currentPhase, onPhaseClick }: PhaseTimelineProps) {
  return (
    <div className="relative">
      {phases.map((phase, index) => {
        const isActive = phase.id === currentPhase;
        const isCompleted = phase.status === 'completed';
        const isInProgress = phase.status === 'in-progress';
        const isLast = index === phases.length - 1;

        return (
          <div key={phase.id} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-5 top-10 w-0.5 h-16",
                  isCompleted ? "bg-emerald-500/50" : "bg-border"
                )}
              />
            )}

            {/* Phase item */}
            <div
              onClick={() => onPhaseClick?.(phase)}
              className={cn(
                "flex items-start gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200",
                isActive && "bg-muted",
                !isActive && "hover:bg-muted/50"
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10",
                  isCompleted && "bg-emerald-500/20",
                  isInProgress && "bg-primary/20",
                  !isCompleted && !isInProgress && "bg-muted border border-border"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : isInProgress ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Phase {phase.id}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-medium text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <h4 className={cn(
                  "font-medium text-sm mt-0.5",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {phase.name}
                </h4>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
