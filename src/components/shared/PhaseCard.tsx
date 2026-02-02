import { cn } from '@/lib/utils';
import { Phase } from '@/lib/mockData';
import { CheckCircle2, Circle, Loader2, Clock, FileOutput, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface PhaseCardProps {
  phase: Phase;
  isActive?: boolean;
  onClick?: () => void;
}

export function PhaseCard({ phase, isActive, onClick }: PhaseCardProps) {
  const statusConfig = {
    'not-started': {
      icon: Circle,
      badge: 'muted' as const,
      label: 'Not Started',
    },
    'in-progress': {
      icon: Loader2,
      badge: 'info' as const,
      label: 'In Progress',
    },
    'completed': {
      icon: CheckCircle2,
      badge: 'success' as const,
      label: 'Completed',
    },
  };

  const config = statusConfig[phase.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "glass-card-hover p-5 cursor-pointer relative overflow-hidden",
        isActive && "border-primary/50 shadow-lg shadow-primary/20 glow-primary"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <motion.div 
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative",
            phase.status === 'completed' && "bg-emerald-500/20 glow-success",
            phase.status === 'in-progress' && "bg-primary/20 glow-primary",
            phase.status === 'not-started' && "bg-muted"
          )}
          whileHover={{ scale: 1.1, rotate: phase.status === 'in-progress' ? 360 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <StatusIcon className={cn(
            "w-5 h-5",
            phase.status === 'completed' && "icon-success drop-shadow-lg",
            phase.status === 'in-progress' && "icon-primary animate-spin",
            phase.status === 'not-started' && "text-muted-foreground"
          )} />
          {phase.status === 'completed' && (
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-emerald-400 animate-pulse" />
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Phase {phase.id}</span>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            {phase.name}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {phase.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{phase.duration}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileOutput className="w-3.5 h-3.5" />
              <span>{phase.outputs.length} outputs</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Shimmer effect on hover */}
      {isActive && (
        <div className="absolute inset-0 shimmer pointer-events-none" />
      )}
    </motion.div>
  );
}
