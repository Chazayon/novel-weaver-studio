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

type StepKind = 'brief' | 'draft' | 'improve' | 'final';

const stepTone: Record<StepKind, { completed: string; inProgress: string; idle: string; dotIdle: string; dotCompleted: string; dotInProgress: string }> = {
  brief: {
    completed: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    inProgress: 'border-sky-500/40 bg-sky-500/15 text-sky-100',
    idle: 'border-sky-500/15 bg-sky-500/5 text-muted-foreground',
    dotIdle: 'text-sky-500/35',
    dotCompleted: 'text-sky-400',
    dotInProgress: 'text-sky-300',
  },
  draft: {
    completed: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    inProgress: 'border-violet-500/40 bg-violet-500/15 text-violet-100',
    idle: 'border-violet-500/15 bg-violet-500/5 text-muted-foreground',
    dotIdle: 'text-violet-500/35',
    dotCompleted: 'text-violet-400',
    dotInProgress: 'text-violet-300',
  },
  improve: {
    completed: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    inProgress: 'border-amber-500/40 bg-amber-500/15 text-amber-100',
    idle: 'border-amber-500/15 bg-amber-500/5 text-muted-foreground',
    dotIdle: 'text-amber-500/35',
    dotCompleted: 'text-amber-400',
    dotInProgress: 'text-amber-300',
  },
  final: {
    completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    inProgress: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
    idle: 'border-emerald-500/15 bg-emerald-500/5 text-muted-foreground',
    dotIdle: 'text-emerald-500/35',
    dotCompleted: 'text-emerald-400',
    dotInProgress: 'text-emerald-300',
  },
};

function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  }
  if (status === 'in-progress') {
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
  }
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/50" />;
}

function StepPill({ label, status, title, kind }: { label: string; status: StepStatus; title: string; kind: StepKind }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] border";
  const tone = stepTone[kind];
  const cls = status === 'completed' ? tone.completed : status === 'in-progress' ? tone.inProgress : tone.idle;

  const dot =
    status === 'completed' ? (
      <CheckCircle2 className={cn('w-3.5 h-3.5', tone.dotCompleted)} />
    ) : status === 'in-progress' ? (
      <Loader2 className={cn('w-3.5 h-3.5 animate-spin', tone.dotInProgress)} />
    ) : (
      <Circle className={cn('w-3.5 h-3.5', tone.dotIdle)} />
    );

  return (
    <span className={cn(base, cls)} title={title}>
      {dot}
      <span>{label}</span>
    </span>
  );
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
        "p-3 lg:p-4 rounded-xl cursor-pointer transition-all duration-200 border",
        isActive 
          ? "bg-gradient-to-br from-primary/12 to-secondary/8 border-primary/30" 
          : "bg-muted/30 hover:bg-muted/50 border-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center shrink-0",
          isActive && "from-primary/25 to-secondary/20"
        )}>
          <span className="text-sm font-bold text-muted-foreground">{chapter.number}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm truncate">{chapter.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {chapter.wordCount > 0 ? `${chapter.wordCount.toLocaleString()} words` : '—'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={isComplete ? 'success' : 'muted'} className="hidden md:flex">
                {isComplete ? 'Complete' : 'In Progress'}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                title={isComplete ? 'Done' : nextStep}
                onClick={(e) => {
                  e.stopPropagation();
                  onContinue?.();
                }}
                disabled={isComplete}
                className={cn(
                  'h-8 w-8 rounded-lg border border-border/50 bg-gradient-to-br from-secondary/50 to-primary/60 text-foreground shadow-sm hover:from-secondary/70 hover:to-primary/80 hover:border-primary/40',
                  isComplete && 'bg-muted/40 text-muted-foreground shadow-none hover:bg-muted/40 hover:border-border/50'
                )}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StepPill label="Brief" status={chapter.sceneBrief} title="Scene Brief" kind="brief" />
            <StepPill label="Draft" status={chapter.draft} title="Draft" kind="draft" />
            <StepPill label="Improve" status={chapter.improvePlan} title="Improve Plan" kind="improve" />
            <StepPill label="Final" status={chapter.final} title="Final" kind="final" />
          </div>
        </div>
      </div>
    </div>
  );
}
