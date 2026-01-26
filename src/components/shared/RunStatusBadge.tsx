import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, XCircle, Clock } from 'lucide-react';

type Status = 'pending' | 'queued' | 'running' | 'success' | 'error';

interface RunStatusBadgeProps {
  status: Status;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: 'Pending',
    className: 'text-muted-foreground bg-muted',
  },
  queued: {
    icon: Clock,
    label: 'Queued',
    className: 'text-amber-400 bg-amber-500/20',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    className: 'text-primary bg-primary/20',
    spin: true,
  },
  success: {
    icon: CheckCircle2,
    label: 'Success',
    className: 'text-emerald-400 bg-emerald-500/20',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    className: 'text-destructive bg-destructive/20',
  },
};

export function RunStatusBadge({ status, showLabel = true, size = 'md' }: RunStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      config.className,
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    )}>
      <Icon className={cn(
        size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5',
        'spin' in config && config.spin && 'animate-spin'
      )} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
