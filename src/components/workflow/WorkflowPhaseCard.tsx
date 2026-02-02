import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Phase } from '@/lib/mockData';
import { AlertCircle, CheckCircle2, Edit, Eye, FileText, Loader2, Play, RefreshCw, XCircle, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface InputsStatus {
  completed: number;
  total: number;
}

interface WorkflowPhaseCardProps {
  activePhase: Phase;
  inputsStatus: InputsStatus;
  isRunning: boolean;
  elapsedTime: number;
  currentPhaseProgress?: number;
  currentStep?: string;
  etaText?: string;
  isCompiling?: boolean;
  hasProject: boolean;
  canViewOutputs: boolean;
  canEditOutputs: boolean;
  canRerun: boolean;
  cancelPending: boolean;
  showOpenChapterStudio: boolean;
  onOpenChapterStudio: () => void;
  onCancelWorkflow: () => void;
  onRunPhase: () => void;
  onViewOutputs: () => void;
  onEditInEditor: () => void;
}

export function WorkflowPhaseCard({
  activePhase,
  inputsStatus,
  isRunning,
  elapsedTime,
  currentPhaseProgress,
  currentStep,
  etaText,
  isCompiling,
  hasProject,
  canViewOutputs,
  canEditOutputs,
  canRerun,
  cancelPending,
  showOpenChapterStudio,
  onOpenChapterStudio,
  onCancelWorkflow,
  onRunPhase,
  onViewOutputs,
  onEditInEditor,
}: WorkflowPhaseCardProps) {
  const showLivePanel = Boolean(isRunning || isCompiling);
  const isBusy = Boolean(isRunning || isCompiling);

  return (
    <motion.div 
      className="glass-card p-4 lg:p-6 mb-6 lg:mb-8 relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Badge
              variant={
              activePhase.status === 'completed'
                ? 'success'
                : activePhase.status === 'in-progress'
                  ? 'info'
                  : 'muted'
              }
              className={activePhase.status === 'in-progress' ? 'glow-primary' : activePhase.status === 'completed' ? 'glow-success' : ''}
            >
              {activePhase.status === 'completed' && <Sparkles className="w-3 h-3 mr-1 icon-success" />}
              {activePhase.status === 'in-progress' && <Loader2 className="w-3 h-3 mr-1 animate-spin icon-primary" />}
              {activePhase.status === 'completed'
                ? 'Completed'
                : activePhase.status === 'in-progress'
                  ? 'In Progress'
                  : 'Not Started'}
            </Badge>
          </motion.div>
          <p className="text-xs lg:text-sm text-muted-foreground mt-2">Estimated duration: {activePhase.duration}</p>
          {showOpenChapterStudio && (
            <p className="text-xs lg:text-sm text-muted-foreground mt-2 italic">
              Use Chapter Studio to write chapters through the scene brief → draft → improve → final pipeline.
            </p>
          )}
        </div>

        {showOpenChapterStudio && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button onClick={onOpenChapterStudio} size="lg" variant="glow" className="w-full sm:w-auto">
              <FileText className="w-4 h-4" />
              Open Chapter Studio
              <Zap className="w-3 h-3 ml-1" />
            </Button>
          </motion.div>
        )}
      </div>

      {/* Live Progress Display */}
      {showLivePanel && (
        <motion.div 
          className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5 glow-primary relative overflow-hidden"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="absolute inset-0 shimmer pointer-events-none" />
          <div className="flex items-start justify-between mb-3 relative z-10">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <h4 className="text-sm font-medium">{isCompiling ? 'Compiling Results' : 'Workflow Running'}</h4>
              </div>

              {/* Time tracking */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span>
                  Elapsed: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
                </span>
                <span>•</span>
                <span>
                  {isCompiling
                    ? 'Finalizing...'
                    : etaText
                      ? `ETA: ${etaText}`
                      : 'ETA: Calculating...'}
                </span>
              </div>

              {currentStep && (
                <p className="text-xs text-muted-foreground mb-3">Current step: {currentStep}</p>
              )}

              {currentPhaseProgress !== undefined && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">Progress: {Number(currentPhaseProgress || 0).toFixed(1)}%</p>
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full glow-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentPhaseProgress || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cancel button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelWorkflow}
              disabled={cancelPending || Boolean(isCompiling)}
              className="ml-4"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>

          <p className="text-sm text-muted-foreground italic relative z-10">
            Note: Results may take a moment to compile after the workflow completes.
          </p>
        </motion.div>
      )}

      <Accordion type="multiple" className="mb-6 rounded-lg border border-border/50 bg-muted/20">
        <AccordionItem value="inputs" className="border-border/50">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Required Inputs</span>
              <span className="text-xs text-muted-foreground">({inputsStatus.completed}/{inputsStatus.total} ready)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="space-y-2">
              {activePhase.requiredInputs.map((input, index) => {
                const isReady = index < inputsStatus.completed;
                return (
                  <motion.div 
                    key={input} 
                    className="flex items-center gap-3 p-2 lg:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {isReady ? (
                      <CheckCircle2 className="w-4 h-4 icon-success shrink-0 drop-shadow-lg" />
                    ) : (
                      <AlertCircle className="w-4 h-4 icon-warning shrink-0 animate-pulse" />
                    )}
                    <span className={`text-sm ${isReady ? 'text-foreground' : 'text-muted-foreground'}`}>{input}</span>
                    {!isReady && (
                      <Badge variant="warning" className="ml-auto text-xs">
                        Missing
                      </Badge>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="outputs" className="border-border/50">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Expected Outputs</span>
              <span className="text-xs text-muted-foreground">({activePhase.outputs.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="flex flex-wrap gap-2">
              {activePhase.outputs.map((output, idx) => (
                <motion.div
                  key={output}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Badge variant="outline" className="text-xs hover:border-primary/50 transition-colors">
                    {output}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 pt-4 border-t border-border">
        <>
          <motion.div
            animate={!isRunning && activePhase.status !== 'completed' && hasProject ? {
              boxShadow: [
                '0 0 20px hsl(var(--primary) / 0.3)',
                '0 0 35px hsl(var(--primary) / 0.5)',
                '0 0 20px hsl(var(--primary) / 0.3)'
              ]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Button
              size="default"
              disabled={activePhase.status === 'completed' || isBusy || !hasProject}
              onClick={onRunPhase}
              variant={isRunning ? 'default' : 'glow'}
              className="min-w-[120px] lg:min-w-[140px]"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{isRunning ? 'Running...' : activePhase.status === 'in-progress' ? 'Continue Phase' : 'Run Phase'}</span>
              <span className="sm:hidden">{isRunning ? '...' : 'Run'}</span>
            </Button>
          </motion.div>
          <Button variant="ghost" size="sm" disabled={!canRerun || isBusy} onClick={onRunPhase}>
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Re-run</span>
          </Button>
        </>
        <Button variant="outline" size="sm" disabled={!canViewOutputs || isBusy} onClick={onViewOutputs}>
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline">View Outputs</span>
        </Button>
        <Button variant="outline" size="sm" disabled={!canEditOutputs || isBusy} onClick={onEditInEditor}>
          <Edit className="w-4 h-4" />
          <span className="hidden md:inline">Edit in Studio</span>
        </Button>
      </div>
      
      {/* Background glow for active running state */}
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none" />
      )}
    </motion.div>
  );
}
