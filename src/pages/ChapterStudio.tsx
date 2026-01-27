import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChapterRow } from '@/components/shared/ChapterRow';
import { EditorTabs } from '@/components/shared/EditorTabs';
import { ArtifactCard } from '@/components/shared/ArtifactCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { mockChapters, mockArtifacts, Chapter } from '@/lib/mockData';
import { 
  Play, 
  Zap, 
  FileText, 
  Sparkles, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tones = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'gritty', label: 'Gritty' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'dark', label: 'Dark' },
  { value: 'whimsical', label: 'Whimsical' },
];

export default function ChapterStudio() {
  const [chapters] = useState(mockChapters);
  const [artifacts] = useState(mockArtifacts);
  const [selectedChapter, setSelectedChapter] = useState<Chapter>(chapters[4]);
  const [targetWordCount, setTargetWordCount] = useState([3000]);
  const [selectedTone, setSelectedTone] = useState('neutral');
  const [isRunning, setIsRunning] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(true);
  const [isControlsOpen, setIsControlsOpen] = useState(true);

  // Mock content
  const chapterContent = {
    sceneBrief: selectedChapter.sceneBrief === 'completed' 
      ? `# Scene Brief: ${selectedChapter.title}\n\n## Setting\nThe chapter opens in the great hall of Castle Thornwood, where torchlight flickers against ancient stone walls. The air is thick with tension...\n\n## Key Beats\n1. Elena discovers the hidden message\n2. Confrontation with the council\n3. The unexpected alliance offer\n\n## Emotional Arc\nAnxiety → Determination → Hope`
      : '',
    draft: selectedChapter.draft === 'completed' || selectedChapter.draft === 'in-progress'
      ? `# Chapter ${selectedChapter.number}: ${selectedChapter.title}\n\nThe great doors of Castle Thornwood groaned as Elena pushed through them, her heart hammering against her ribs. The council had assembled without her knowledge—a breach of protocol that set her teeth on edge.\n\n"You weren't meant to be here," Lord Castellan said, his weathered face illuminated by candlelight. The others shifted uncomfortably in their high-backed chairs.\n\n"Yet here I am." Elena's voice didn't waver, though her hands trembled beneath her cloak. "Perhaps someone would like to explain why decisions about my kingdom are being made in shadows?"\n\nThe silence that followed was deafening...`
      : '',
    improvePlan: selectedChapter.improvePlan === 'completed'
      ? `# Improvement Analysis\n\n## Strengths\n- Strong opening tension\n- Effective dialogue pacing\n- Good sensory details\n\n## Areas for Enhancement\n1. **Deepen Elena's internal conflict** - Add more internal monologue showing her fear\n2. **Expand council member descriptions** - Give at least 2 members distinct characteristics\n3. **Strengthen the hook** - End scene with a more dramatic revelation\n\n## Specific Suggestions\n- Paragraph 2: Add physical reaction (clenched fists, dry throat)\n- Paragraph 4: Include a telling detail about Lord Castellan's motivations`
      : '',
    final: selectedChapter.final === 'completed'
      ? `# Chapter ${selectedChapter.number}: ${selectedChapter.title}\n\n[Final polished version with all improvements applied...]`
      : '',
  };

  const pinnedArtifacts = artifacts.filter(a => a.pinned);

  const handleRunStep = (step: string) => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  };

  const completedChapters = chapters.filter(c => c.final === 'completed').length;
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left panel toggle when collapsed */}
        {!isChaptersOpen && (
          <Button
            variant="glass"
            size="icon"
            className="fixed left-4 top-20 z-40"
            onClick={() => setIsChaptersOpen(true)}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </Button>
        )}

        {/* Left - Chapter list */}
        <div className={cn(
          "shrink-0 border-r border-border bg-sidebar/50 flex flex-col transition-all duration-300",
          isChaptersOpen ? "w-80" : "w-0 overflow-hidden"
        )}>
          <div className="w-80">
            {/* Header with collapse */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg font-semibold">Chapters</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsChaptersOpen(false)}>
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{completedChapters}/{chapters.length} complete</span>
                <span>{totalWords.toLocaleString()} words</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-12rem)]">
              {chapters.map((chapter) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  isActive={selectedChapter.id === chapter.id}
                  onClick={() => setSelectedChapter(chapter)}
                  onContinue={() => setSelectedChapter(chapter)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Center - Editor workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chapter header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    const idx = chapters.findIndex(c => c.id === selectedChapter.id);
                    if (idx > 0) setSelectedChapter(chapters[idx - 1]);
                  }}
                  disabled={chapters[0].id === selectedChapter.id}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    const idx = chapters.findIndex(c => c.id === selectedChapter.id);
                    if (idx < chapters.length - 1) setSelectedChapter(chapters[idx + 1]);
                  }}
                  disabled={chapters[chapters.length - 1].id === selectedChapter.id}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">
                  Chapter {selectedChapter.number}: {selectedChapter.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedChapter.wordCount.toLocaleString()} words
                </p>
              </div>
            </div>
            <Badge variant={selectedChapter.final === 'completed' ? 'success' : 'info'}>
              {selectedChapter.final === 'completed' ? 'Complete' : 'In Progress'}
            </Badge>
          </div>

          {/* Editor tabs */}
          <div className="flex-1 p-4 overflow-hidden">
            <EditorTabs
              sceneBrief={chapterContent.sceneBrief}
              draft={chapterContent.draft}
              improvePlan={chapterContent.improvePlan}
              final={chapterContent.final}
            />
          </div>
        </div>

        {/* Right panel toggle when collapsed */}
        {!isControlsOpen && (
          <Button
            variant="glass"
            size="icon"
            className="fixed right-4 top-20 z-40"
            onClick={() => setIsControlsOpen(true)}
          >
            <PanelRightOpen className="w-4 h-4" />
          </Button>
        )}

        {/* Right - Controls panel */}
        <div className={cn(
          "shrink-0 border-l border-border bg-sidebar/50 flex flex-col transition-all duration-300",
          isControlsOpen ? "w-80" : "w-0 overflow-hidden"
        )}>
          <div className="w-80">
            {/* Header with collapse */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg font-semibold">Controls</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsControlsOpen(false)}>
                <PanelRightClose className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 max-h-[calc(100vh-8rem)]">
              {/* Previous chapter preview */}
              {selectedChapter.number > 1 && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                    Previous Chapter
                  </Label>
                  <div className="glass-card p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">
                        Ch. {selectedChapter.number - 1}: {chapters[selectedChapter.number - 2]?.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      The previous chapter ended with Elena discovering the hidden message in the ancient tome...
                    </p>
                  </div>
                </div>
              )}

              {/* Pinned artifacts */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  Quick Reference
                </Label>
                <div className="space-y-2">
                  {pinnedArtifacts.slice(0, 4).map((artifact) => (
                    <ArtifactCard key={artifact.id} artifact={artifact} compact />
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  Generation Settings
                </Label>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">Target Word Count</Label>
                      <span className="text-sm font-medium text-primary">
                        {targetWordCount[0].toLocaleString()}
                      </span>
                    </div>
                    <Slider
                      value={targetWordCount}
                      onValueChange={setTargetWordCount}
                      min={1000}
                      max={6000}
                      step={500}
                      className="[&_[role=slider]]:bg-primary"
                    />
                  </div>

                  <div>
                    <Label className="text-sm mb-2 block">Tone</Label>
                    <Select value={selectedTone} onValueChange={setSelectedTone}>
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {tones.map((tone) => (
                          <SelectItem key={tone.value} value={tone.value}>
                            {tone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Run buttons */}
              <div className="space-y-2 pt-4 border-t border-border">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleRunStep('scene-brief')}
                  disabled={isRunning || selectedChapter.sceneBrief === 'completed'}
                >
                  <FileText className="w-4 h-4" />
                  Generate Scene Brief
                  {selectedChapter.sceneBrief === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                  )}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleRunStep('draft')}
                  disabled={isRunning || selectedChapter.sceneBrief !== 'completed'}
                >
                  <Sparkles className="w-4 h-4" />
                  Draft Chapter
                  {selectedChapter.draft === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                  )}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleRunStep('improve')}
                  disabled={isRunning || selectedChapter.draft !== 'completed'}
                >
                  <Play className="w-4 h-4" />
                  Analyze & Improve
                  {selectedChapter.improvePlan === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                  )}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleRunStep('final')}
                  disabled={isRunning || selectedChapter.improvePlan !== 'completed'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Improvements
                  {selectedChapter.final === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 ml-auto text-status-success" />
                  )}
                </Button>

                <div className="pt-2">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => handleRunStep('full')}
                    disabled={isRunning || selectedChapter.final === 'completed'}
                  >
                    <Zap className="w-4 h-4" />
                    {isRunning ? 'Running...' : 'Run Full Pipeline'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
