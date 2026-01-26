import { Chapter } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface ChapterRowProps {
  chapter: Chapter;
  isActive?: boolean;
  onClick?: () => void;
  onContinue?: () => void;
}

type StepStatus = 'not-started' | 'in-progress' | 'completed';

function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  }
  if (status === 'in-progress') {
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
  }
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/50" />;
}

export function ChapterRow({ chapter, isActive, onClick, onContinue }: ChapterRowProps) {
  const getNextStep = (): string => {
    if (chapter.sceneBrief !== 'completed') return 'Generate Scene Brief';
    if (chapter.draft !== 'completed') return 'Draft Chapter';
    if (chapter.improvePlan !== 'completed') return 'Create Improve Plan';
    if (chapter.final !== 'completed') return 'Finalize Chapter';
    return 'Complete';
  };

  const isComplete = chapter.final === 'completed';
  const nextStep = getNextStep();

  return (
    <div
      onClick={onClick}
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center p-4 rounded-xl cursor-pointer transition-all duration-200",
        isActive 
          ? "bg-primary/10 border border-primary/30" 
          : "bg-muted/30 hover:bg-muted/50 border border-transparent"
      )}
    >
      {/* Chapter number */}
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        <span className="text-sm font-bold text-muted-foreground">
          {chapter.number}
        </span>
      </div>

      {/* Title */}
      <div className="min-w-0">
        <h4 className="font-medium text-sm truncate">{chapter.title}</h4>
        {chapter.wordCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {chapter.wordCount.toLocaleString()} words
          </p>
        )}
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-1" title="Scene Brief">
        <StatusDot status={chapter.sceneBrief} />
        <span className="text-[10px] text-muted-foreground hidden lg:inline">Brief</span>
      </div>

      <div className="flex items-center gap-1" title="Draft">
        <StatusDot status={chapter.draft} />
        <span className="text-[10px] text-muted-foreground hidden lg:inline">Draft</span>
      </div>

      <div className="flex items-center gap-1" title="Improve Plan">
        <StatusDot status={chapter.improvePlan} />
        <span className="text-[10px] text-muted-foreground hidden lg:inline">Improve</span>
      </div>

      <div className="flex items-center gap-1" title="Final">
        <StatusDot status={chapter.final} />
        <span className="text-[10px] text-muted-foreground hidden lg:inline">Final</span>
      </div>

      {/* Overall status */}
      <Badge variant={isComplete ? 'success' : 'muted'} className="hidden sm:flex">
        {isComplete ? 'Complete' : 'In Progress'}
      </Badge>

      {/* Continue button */}
      <Button
        size="sm"
        variant={isComplete ? 'outline' : 'default'}
        onClick={(e) => {
          e.stopPropagation();
          onContinue?.();
        }}
        disabled={isComplete}
        className="min-w-[100px]"
      >
        {isComplete ? (
          'Done'
        ) : (
          <>
            <Play className="w-3 h-3" />
            Continue
          </>
        )}
      </Button>
    </div>
  );
}
