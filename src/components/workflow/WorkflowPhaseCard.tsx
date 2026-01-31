import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Phase } from '@/lib/mockData';
import { AlertCircle, CheckCircle2, Edit, Eye, FileText, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';

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
  return (
    <div className="glass-card p-4 lg:p-6 mb-6 lg:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <Badge
            variant={
              activePhase.status === 'completed'
                ? 'success'
                : activePhase.status === 'in-progress'
                  ? 'info'
                  : 'muted'
            }
          >
            {activePhase.status === 'completed'
              ? 'Completed'
              : activePhase.status === 'in-progress'
                ? 'In Progress'
                : 'Not Started'}
          </Badge>
          <p className="text-xs lg:text-sm text-muted-foreground mt-2">Estimated duration: {activePhase.duration}</p>
          {showOpenChapterStudio && (
            <p className="text-xs lg:text-sm text-muted-foreground mt-2 italic">
              Use Chapter Studio to write chapters through the scene brief → draft → improve → final pipeline.
            </p>
          )}
        </div>

        {showOpenChapterStudio && (
          <Button onClick={onOpenChapterStudio} size="lg" className="w-full sm:w-auto">
            <FileText className="w-4 h-4" />
            Open Chapter Studio
          </Button>
        )}
      </div>

      {/* Live Progress Display */}
      {isRunning && (
        <div className="mb-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <h4 className="text-sm font-medium">Workflow Running</h4>
              </div>

              {/* Time tracking */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span>
                  Elapsed: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
                </span>
                <span>•</span>
                <span>Est. total: {activePhase.duration}</span>
              </div>

              {currentPhaseProgress !== undefined && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">Progress: {Number(currentPhaseProgress || 0).toFixed(1)}%</p>
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentPhaseProgress || 0}%` }}
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
              disabled={cancelPending}
              className="ml-4"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>

          <p className="text-sm text-muted-foreground italic">
            Note: Workflows can take 5-10 minutes. The workflow will continue running even if you navigate away.
          </p>
        </div>
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
                  <div key={input} className="flex items-center gap-3 p-2 lg:p-3 rounded-lg bg-muted/30">
                    {isReady ? (
                      <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
                    )}
                    <span className={`text-sm ${isReady ? 'text-foreground' : 'text-muted-foreground'}`}>{input}</span>
                    {!isReady && (
                      <Badge variant="warning" className="ml-auto text-xs">
                        Missing
                      </Badge>
                    )}
                  </div>
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
              {activePhase.outputs.map((output) => (
                <Badge key={output} variant="outline" className="text-xs">
                  {output}
                </Badge>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 pt-4 border-t border-border">
        {!showOpenChapterStudio && (
          <>
            <Button
              size="default"
              disabled={activePhase.status === 'completed' || isRunning || !hasProject}
              onClick={onRunPhase}
              className="min-w-[120px] lg:min-w-[140px]"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{isRunning ? 'Running...' : activePhase.status === 'in-progress' ? 'Continue Phase' : 'Run Phase'}</span>
              <span className="sm:hidden">{isRunning ? '...' : 'Run'}</span>
            </Button>
            <Button variant="ghost" size="sm" disabled={!canRerun} onClick={onRunPhase}>
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Re-run</span>
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" disabled={!canViewOutputs} onClick={onViewOutputs}>
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline">View Outputs</span>
        </Button>
        {!showOpenChapterStudio && (
          <Button variant="outline" size="sm" disabled={!canEditOutputs} onClick={onEditInEditor}>
            <Edit className="w-4 h-4" />
            <span className="hidden md:inline">Edit in Editor</span>
          </Button>
        )}
      </div>
    </div>
  );
}
