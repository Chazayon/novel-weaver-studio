import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PhaseTimeline } from '@/components/shared/PhaseTimeline';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mockPhases, mockArtifacts, Phase } from '@/lib/mockData';
import { 
  Play, 
  Eye, 
  Edit, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  FileText,
  Layers,
  Pin
} from 'lucide-react';

export default function WorkflowCockpit() {
  const navigate = useNavigate();
  const [phases] = useState(mockPhases);
  const [artifacts] = useState(mockArtifacts);
  const [currentPhase, setCurrentPhase] = useState(6);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isPhasesOpen, setIsPhasesOpen] = useState(true);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const activePhase = phases.find((p) => p.id === currentPhase) || phases[5];

  const getRequiredInputsStatus = (phase: Phase) => {
    const completed = phase.requiredInputs.length - (phase.status === 'not-started' ? 2 : 0);
    return {
      completed,
      total: phase.requiredInputs.length,
      missing: phase.requiredInputs.slice(completed),
    };
  };

  const inputsStatus = getRequiredInputsStatus(activePhase);

  // Mock output content based on phase
  const getPhaseOutputContent = () => {
    switch (activePhase.id) {
      case 1:
        return "# Research Results\n\n## Genre Analysis\n- Fantasy market trends show strong demand for epic narratives\n- Character-driven stories are performing well\n\n## Competitive Titles\n1. The Name of the Wind\n2. The Way of Kings\n3. Mistborn";
      case 2:
        return "# Series Outline\n\n## Arc 1: The Awakening (Books 1-3)\n- Introduction to the world\n- Discovery of the ancient prophecy\n\n## Arc 2: The Conflict (Books 4-6)\n- Rising tensions between kingdoms\n- Hero's transformation";
      case 3:
        return "# Call Sheet\n\n## Main Characters\n- **Elena Thornwood**: Protagonist, reluctant queen\n- **Marcus Vale**: Mentor figure, retired knight\n\n## Key Locations\n- Castle Thornwood\n- The Whispering Forest";
      case 4:
        return "# Characters & Worldbuilding\n\n## Character Profiles\n### Elena Thornwood\n- Age: 24\n- Role: Reluctant heir to the throne\n- Motivation: Protect her people\n\n## World Details\n- Magic system based on elemental bonds\n- Three major kingdoms in alliance";
      case 5:
        return "# Chapter Outline\n\n## Chapter 1: The Summons\n- Elena receives urgent message\n- Introduction to court politics\n\n## Chapter 2: Hidden Truths\n- Discovery of the ancient library\n- First hint of magical ability";
      case 6:
        return "# Chapter Writing Progress\n\nCompleted chapters: 5/24\n\nReady for final compilation.\n\n[View in Chapter Studio for detailed editing]";
      case 7:
        return "# Final Manuscript\n\nAll chapters compiled and ready for export.";
      default:
        return "No output available yet.";
    }
  };

  const handleViewOutputs = () => {
    setIsOutputModalOpen(true);
  };

  const handleEditInEditor = () => {
    if (activePhase.id === 6) {
      navigate('/chapter-studio');
    } else if (activePhase.id === 7) {
      navigate('/compile');
    } else {
      // Navigate to phase-specific editor for phases 1-5
      navigate(`/phase-editor/${activePhase.id}`);
    }
  };

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 2000);
  };

  const pinnedArtifacts = artifacts.filter(a => a.pinned);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left sidebar - Phases */}
        <CollapsiblePanel
          title="Phases"
          icon={<Layers className="w-4 h-4" />}
          isOpen={isPhasesOpen}
          onToggle={() => setIsPhasesOpen(!isPhasesOpen)}
          side="left"
        >
          <div className="p-4">
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
        </CollapsiblePanel>

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
                disabled={activePhase.status === 'completed' || isRunning}
                className="min-w-[140px]"
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Running...' : activePhase.status === 'in-progress' ? 'Continue Phase' : 'Run Phase'}
              </Button>
              <Button 
                variant="outline" 
                disabled={activePhase.status === 'not-started'}
                onClick={handleViewOutputs}
              >
                <Eye className="w-4 h-4" />
                View Outputs
              </Button>
              <Button 
                variant="outline" 
                disabled={activePhase.status === 'not-started'}
                onClick={handleEditInEditor}
              >
                <Edit className="w-4 h-4" />
                Edit in Editor
              </Button>
              <Button 
                variant="ghost" 
                disabled={activePhase.status !== 'completed' || isRunning}
                onClick={handleRerun}
              >
                <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
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

        {/* Context Panel */}
        <CollapsiblePanel
          title="Context"
          icon={<Pin className="w-4 h-4" />}
          isOpen={isContextOpen}
          onToggle={() => setIsContextOpen(!isContextOpen)}
          side="right"
        >
          <div className="p-4 space-y-6">
            {/* Pinned artifacts */}
            {pinnedArtifacts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pinned
                  </span>
                </div>
                <div className="space-y-2">
                  {pinnedArtifacts.map((artifact) => (
                    <ArtifactCard key={artifact.id} artifact={artifact} compact />
                  ))}
                </div>
              </div>
            )}

            {/* All artifacts */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                All Artifacts
              </span>
              <div className="space-y-2 mt-3">
                {artifacts.filter(a => !a.pinned).map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
                ))}
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>

      {/* Output Modal */}
      <Dialog open={isOutputModalOpen} onOpenChange={setIsOutputModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Phase {activePhase.id} Outputs: {activePhase.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                {getPhaseOutputContent()}
              </pre>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsOutputModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleEditInEditor}>
              <Edit className="w-4 h-4" />
              Edit in Editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
