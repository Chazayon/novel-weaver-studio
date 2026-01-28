import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { MarkdownEditor } from '@/components/shared/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePanelState } from '@/hooks/usePanelState';
import { mockPhases, mockArtifacts } from '@/lib/mockData';
import { 
  ArrowLeft,
  Layers,
  FileText,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function PhaseEditor() {
  const { phaseId } = useParams();
  const navigate = useNavigate();
  const currentPhaseId = parseInt(phaseId || '1');
  
  const [phases] = useState(mockPhases);
  const [artifacts] = useState(mockArtifacts);
  const [isPhasesOpen, togglePhasesOpen] = usePanelState('phase-editor-phases', true);
  const [isContextOpen, toggleContextOpen] = usePanelState('phase-editor-context', true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const currentPhase = phases.find(p => p.id === currentPhaseId) || phases[0];
  
  // Mock output content based on phase
  const getPhaseContent = () => {
    switch (currentPhaseId) {
      case 1:
        return `# Research Results

## Genre Analysis
- Fantasy market trends show strong demand for epic narratives
- Character-driven stories are performing well
- Series with 3-6 books tend to have highest completion rates

## Competitive Titles
1. **The Name of the Wind** by Patrick Rothfuss
   - Lyrical prose, deep magic system
   - Strong first-person narrative
   
2. **The Way of Kings** by Brandon Sanderson
   - Epic scope, multiple POVs
   - Detailed worldbuilding
   
3. **Mistborn** by Brandon Sanderson
   - Unique magic system
   - Strong female protagonist

## Target Audience
- Age: 18-45
- Readers who enjoy epic fantasy with deep worldbuilding
- Fans of character-driven narratives`;
      case 2:
        return `# Series Outline

## Arc 1: The Awakening (Books 1-3)
- **Book 1: The Hidden Heir**
  - Introduction to Elena and the world
  - Discovery of the ancient prophecy
  - First manifestation of powers
  
- **Book 2: The Gathering Storm**
  - Training and growth
  - Building alliances
  - First major conflict
  
- **Book 3: The Breaking Point**
  - Betrayal and loss
  - Elena's transformation
  - Climactic battle

## Arc 2: The Conflict (Books 4-6)
- Rising tensions between kingdoms
- Hero's transformation and mastery
- Ultimate confrontation with darkness`;
      case 3:
        return `# Call Sheet

## Main Characters
- **Elena Thornwood**: Protagonist, reluctant queen
  - Age: 24
  - Role: Hidden heir to the throne
  - Arc: From reluctant leader to confident ruler
  
- **Marcus Vale**: Mentor figure, retired knight
  - Age: 58
  - Role: Guardian and trainer
  - Secret: Knows the truth about Elena's parents

## Key Locations
1. **Castle Thornwood** - Ancient seat of power
2. **The Whispering Forest** - Magical boundary
3. **The Crystal Caverns** - Source of magic
4. **Port Seren** - Trading hub and escape route`;
      case 4:
        return `# Characters & Worldbuilding

## Character Profiles

### Elena Thornwood
- **Age**: 24
- **Role**: Reluctant heir to the throne
- **Motivation**: Protect her people at all costs
- **Fear**: Losing herself to power
- **Strength**: Empathy and determination
- **Weakness**: Trust issues from betrayal

### Marcus Vale  
- **Age**: 58
- **Role**: Mentor, retired knight
- **Motivation**: Redemption for past failures
- **Secret**: Was present when Elena's parents died

## World Details

### Magic System
- Based on elemental bonds
- Requires emotional connection
- Has a physical cost (exhaustion, pain)

### Political Structure
- Three major kingdoms in uneasy alliance
- Council of Elders holds balance of power
- Ancient bloodlines carry magical ability`;
      case 5:
        return `# Chapter Outline

## Part One: The Summons

### Chapter 1: The Summons
- Elena receives urgent message at dawn
- Introduction to her daily life and responsibilities
- First hint of danger approaching
- Ends with: Decision to answer the call

### Chapter 2: Hidden Truths
- Discovery of the ancient library
- First hint of magical ability manifests
- Meeting with Marcus Vale
- Revelation about her heritage

### Chapter 3: The Journey Begins
- Departure from the only home she's known
- First encounter with magical creatures
- Establishing the bond with her companion
- Arrival at the crossroads

## Part Two: The Awakening

### Chapter 4: Castle Thornwood
- First glimpse of her birthright
- Introduction to the court
- Conflict with the council
- The weight of expectation`;
      default:
        return 'No content available for this phase.';
    }
  };

  const [content, setContent] = useState(getPhaseContent());

  // Update content when phase changes
  useEffect(() => {
    setContent(getPhaseContent());
  }, [currentPhaseId]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Changes saved successfully');
    }, 1000);
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      setContent(getPhaseContent());
      toast.success('Content regenerated');
    }, 2000);
  };

  const pinnedArtifacts = artifacts.filter(a => a.pinned);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left - Phases panel */}
        <CollapsiblePanel
          title="Phases"
          icon={<Layers className="w-4 h-4" />}
          isOpen={isPhasesOpen}
          onToggle={togglePhasesOpen}
          side="left"
        >
          <div className="p-3 lg:p-4">
            <div className="mb-4 lg:mb-6">
              <h2 className="font-display text-base lg:text-lg font-semibold mb-1">The Forgotten Kingdom</h2>
              <p className="text-xs lg:text-sm text-muted-foreground">Fantasy • 24 chapters</p>
            </div>

            <div className="space-y-1">
              {phases.slice(0, 5).map((phase) => (
                <button
                  key={phase.id}
                  onClick={() => navigate(`/phase-editor/${phase.id}`)}
                  className={cn(
                    "w-full text-left p-2 lg:p-3 rounded-lg transition-all",
                    phase.id === currentPhaseId
                      ? "bg-primary/20 border border-primary/50"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div className={cn(
                      "w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                      phase.status === 'completed' ? "bg-status-success text-white" :
                      phase.status === 'in-progress' ? "bg-primary text-white" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {phase.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                      ) : (
                        phase.id
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs lg:text-sm font-medium truncate",
                        phase.id === currentPhaseId ? "text-primary" : "text-foreground"
                      )}>
                        {phase.name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 lg:mt-6 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => navigate('/cockpit')}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Cockpit
              </Button>
            </div>
          </div>
        </CollapsiblePanel>

        {/* Center - Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 lg:p-4 border-b border-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground mb-1">
                <span>Phase {currentPhase.id}</span>
              </div>
              <h1 className="font-display text-base lg:text-xl font-semibold truncate">
                {currentPhase.name}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={
                currentPhase.status === 'completed' ? 'success' :
                currentPhase.status === 'in-progress' ? 'info' : 'muted'
              }>
                {currentPhase.status === 'completed' ? 'Completed' :
                 currentPhase.status === 'in-progress' ? 'In Progress' : 'Not Started'}
              </Badge>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 p-2 lg:p-4 overflow-hidden">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              onSave={handleSave}
              isSaving={isSaving}
              placeholder="Start writing your phase content..."
            />
          </div>

          {/* Footer actions */}
          <div className="p-3 lg:p-4 border-t border-border flex items-center justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={cn("w-4 h-4", isRegenerating && "animate-spin")} />
              <span className="hidden sm:inline">{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </Button>
          </div>
        </div>

        {/* Right - Context panel */}
        <CollapsiblePanel
          title="Context"
          icon={<FileText className="w-4 h-4" />}
          isOpen={isContextOpen}
          onToggle={toggleContextOpen}
          side="right"
        >
          <div className="p-3 lg:p-4 space-y-4 lg:space-y-6">
            {/* Phase outputs */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Expected Outputs
              </span>
              <div className="mt-2 lg:mt-3 space-y-1.5 lg:space-y-2">
                {currentPhase.outputs.map((output) => (
                  <div key={output} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary shrink-0" />
                    <span className="text-xs lg:text-sm truncate">{output}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pinned artifacts */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reference Artifacts
              </span>
              <div className="mt-2 lg:mt-3 space-y-1.5 lg:space-y-2">
                {pinnedArtifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
                ))}
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
    </AppLayout>
  );
}
