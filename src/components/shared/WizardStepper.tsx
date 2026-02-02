import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'current' | 'completed';
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';
        const isLast = index === steps.length - 1;

        return (
          <motion.div 
            key={step.id} 
            className="flex items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <motion.div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all relative",
                  isCompleted && "bg-emerald-500/20 text-emerald-400 glow-success",
                  isCurrent && "bg-primary/20 text-primary ring-2 ring-primary/30 glow-primary",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 icon-success drop-shadow-lg" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 icon-primary animate-spin" />
                ) : (
                  <span>{index + 1}</span>
                )}
                {isCompleted && (
                  <Sparkles className="w-2 h-2 absolute -top-0.5 -right-0.5 text-emerald-400 animate-pulse" />
                )}
              </motion.div>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:inline",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <motion.div
                className={cn(
                  "w-12 h-0.5 mx-3 relative overflow-hidden",
                  isCompleted ? "bg-emerald-500/50" : "bg-border"
                )}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: index * 0.1 + 0.2 }}
              >
                {isCompleted && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/50 to-primary/50"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
