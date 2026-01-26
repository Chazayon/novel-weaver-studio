import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PhaseTimeline } from '@/components/shared/PhaseTimeline';
import { PhaseCard } from '@/components/shared/PhaseCard';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { ContextDrawer } from '@/components/shared/ContextDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockPhases, mockArtifacts, Phase } from '@/lib/mockData';
import { 
  Play, 
  Eye, 
  Edit, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  FileText
} from 'lucide-react';

export default function WorkflowCockpit() {
  const navigate = useNavigate();
  const [phases] = useState(mockPhases);
  const [artifacts] = useState(mockArtifacts);
  const [currentPhase, setCurrentPhase] = useState(6);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const activePhase = phases.find((p) => p.id === currentPhase) || phases[5];

  const getRequiredInputsStatus = (phase: Phase) => {
    // Mock: return status of required inputs
    const completed = phase.requiredInputs.length - (phase.status === 'not-started' ? 2 : 0);
    return {
      completed,
      total: phase.requiredInputs.length,
      missing: phase.requiredInputs.slice(completed),
    };
  };

  const inputsStatus = getRequiredInputsStatus(activePhase);

  return (
    <AppLayout>
      <div className={`flex transition-all duration-300 ${isDrawerOpen ? 'pr-80' : ''}`}>
        {/* Left sidebar - Phase Timeline */}
        <div className="w-72 shrink-0 border-r border-border bg-sidebar/50 p-4 min-h-[calc(100vh-4rem)]">
          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold mb-1">The Forgotten Kingdom</h2>
            <p className="text-sm text-muted-foreground">Fantasy • 24 chapters</p>
          </div>

          <div className="mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workflow Phases
            </span>
          </div>

          <PhaseTimeline
            phases={phases}
            currentPhase={currentPhase}
            onPhaseClick={(phase) => setCurrentPhase(phase.id)}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 p-8 min-h-[calc(100vh-4rem)]">
          {/* Current phase header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Phase {activePhase.id}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground">{activePhase.name}</span>
            </div>
            <h1 className="font-display text-3xl font-bold gradient-text mb-2">
              {activePhase.name}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              {activePhase.description}
            </p>
          </div>

          {/* Phase card */}
          <div className="glass-card p-6 mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <Badge variant={
                  activePhase.status === 'completed' ? 'success' :
                  activePhase.status === 'in-progress' ? 'info' : 'muted'
                }>
                  {activePhase.status === 'completed' ? 'Completed' :
                   activePhase.status === 'in-progress' ? 'In Progress' : 'Not Started'}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Estimated duration: {activePhase.duration}
                </p>
              </div>
              
              {activePhase.id === 6 && (
                <Button onClick={() => navigate('/chapter-studio')}>
                  <FileText className="w-4 h-4" />
                  Open Chapter Studio
                </Button>
              )}
            </div>

            {/* Required inputs */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                Required Inputs
                <span className="text-xs text-muted-foreground">
                  ({inputsStatus.completed}/{inputsStatus.total} ready)
                </span>
              </h3>
              <div className="space-y-2">
                {activePhase.requiredInputs.map((input, index) => {
                  const isReady = index < inputsStatus.completed;
                  return (
                    <div
                      key={input}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      {isReady ? (
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
                      )}
                      <span className={isReady ? 'text-foreground' : 'text-muted-foreground'}>
                        {input}
                      </span>
                      {!isReady && (
                        <Badge variant="warning" className="ml-auto">
                          Missing
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expected outputs */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Expected Outputs</h3>
              <div className="flex flex-wrap gap-2">
                {activePhase.outputs.map((output) => (
                  <Badge key={output} variant="outline">
                    {output}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button 
                size="lg" 
                disabled={activePhase.status === 'completed'}
                className="min-w-[140px]"
              >
                <Play className="w-4 h-4" />
                {activePhase.status === 'in-progress' ? 'Continue Phase' : 'Run Phase'}
              </Button>
              <Button variant="outline" disabled={activePhase.status === 'not-started'}>
                <Eye className="w-4 h-4" />
                View Outputs
              </Button>
              <Button variant="outline" disabled={activePhase.status === 'not-started'}>
                <Edit className="w-4 h-4" />
                Edit in Editor
              </Button>
              <Button 
                variant="ghost" 
                disabled={activePhase.status !== 'completed'}
              >
                <RefreshCw className="w-4 h-4" />
                Re-run
              </Button>
            </div>
          </div>

          {/* Recent artifacts */}
          <div>
            <h3 className="text-lg font-display font-semibold mb-4">Recent Artifacts</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {artifacts.slice(0, 3).map((artifact, index) => (
                <div
                  key={artifact.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ArtifactCard artifact={artifact} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Context Drawer */}
        <ContextDrawer
          artifacts={artifacts}
          isOpen={isDrawerOpen}
          onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
        />
      </div>
    </AppLayout>
  );
}
