import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronRight, Pin } from 'lucide-react';
import { useEffect } from 'react';

let sharedAudioContext: AudioContext | null = null;

function getAudioContextCtor(): typeof AudioContext | undefined {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function getSharedAudioContext(): AudioContext | null {
  const ctor = getAudioContextCtor();
  if (!ctor) return null;
  if (!sharedAudioContext) sharedAudioContext = new ctor();
  return sharedAudioContext;
}

async function unlockSharedAudioContext(): Promise<AudioContext | null> {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return ctx;
    }
  }
  return ctx;
}

async function playBeep(): Promise<void> {
  const ctx = await unlockSharedAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

interface PhaseCompletionData {
  artifacts?: {
    genre_tropes?: string;
    style_sheet?: string;
    context_bundle?: string;
  };
  result?: string;
  output?: string;
  [key: string]: unknown;
}

interface PhaseCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhase: number;
  completionData: PhaseCompletionData | null;
  activeTab: 'genre_tropes' | 'style_sheet' | 'context_bundle';
  onTabChange: (tab: 'genre_tropes' | 'style_sheet' | 'context_bundle') => void;
  onSavePhase1ActiveTab: () => void;
  onSavePhase1All: () => void;
  onSaveOutput: (key: string, name: string, content: string) => void;
  onClose: () => void;
  onContinue: () => void;
  onOpenChapterStudio?: () => void;
}

export function PhaseCompletionDialog({
  open,
  onOpenChange,
  currentPhase,
  completionData,
  activeTab,
  onTabChange,
  onSavePhase1ActiveTab,
  onSavePhase1All,
  onSaveOutput,
  onClose,
  onContinue,
  onOpenChapterStudio,
}: PhaseCompletionDialogProps) {
  useEffect(() => {
    const unlock = () => {
      void unlockSharedAudioContext();
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void playBeep();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Phase {currentPhase} Completed! 🎉</DialogTitle>
          <DialogDescription>
            {currentPhase === 1
              ? 'Your novel foundation has been created. Review the outputs below.'
              : 'The workflow has successfully finished. Here are the generated results.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-hidden">
          <ScrollArea className="h-[400px]">
            {currentPhase === 1 && completionData?.artifacts ? (
              /* Phase 1: Tabbed artifacts */
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                  <button
                    onClick={() => onTabChange('genre_tropes')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'genre_tropes'
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Genre Tropes
                  </button>
                  <button
                    onClick={() => onTabChange('style_sheet')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'style_sheet'
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Style Sheet
                  </button>
                  <button
                    onClick={() => onTabChange('context_bundle')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'context_bundle'
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Context Bundle
                  </button>
                </div>
                <div className="p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
                      {activeTab === 'genre_tropes' && (completionData.artifacts.genre_tropes || 'No content available')}
                      {activeTab === 'style_sheet' && (completionData.artifacts.style_sheet || 'No content available')}
                      {activeTab === 'context_bundle' && (completionData.artifacts.context_bundle || 'No content available')}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              /* Other phases: Parse and show outputs */
              <div className="p-4 space-y-4">
                {(() => {
                  // Try to parse completion data if it's a string
                  let parsedData = completionData;
                  console.log('Completion dialog - raw data:', completionData);
                  if (typeof completionData === 'string') {
                    try {
                      parsedData = JSON.parse(completionData);
                      console.log('Parsed from string:', parsedData);
                    } catch (e) {
                      parsedData = { content: completionData };
                    }
                  }

                  // Extract the actual content from various possible fields
                  const extractContent = (data: unknown): { title: string; content: string } | null => {
                    if (!data || typeof data !== 'object') return null;
                    const obj = data as Record<string, unknown>;

                    // Phase 2: series_outline
                    if (typeof obj.series_outline === 'string') return { title: 'Series Outline', content: obj.series_outline };
                    // Phase 3: call_sheet
                    if (typeof obj.call_sheet === 'string') return { title: 'Call Sheet', content: obj.call_sheet };
                    // Phase 4: character_profiles or worldbuilding
                    if (typeof obj.character_profiles === 'string') return { title: 'Character Profiles', content: obj.character_profiles };
                    if (typeof obj.characters === 'string') return { title: 'Character Profiles', content: obj.characters };
                    if (typeof obj.worldbuilding === 'string') return { title: 'Worldbuilding', content: obj.worldbuilding };
                    // Phase 5: outline (from Phase5Output)
                    if (typeof obj.outline === 'string') return { title: 'Chapter Outline', content: obj.outline };
                    if (typeof obj.chapter_outline === 'string') return { title: 'Chapter Outline', content: obj.chapter_outline };
                    // Phase 6: final chapter
                    if (typeof obj.final_chapter === 'string') return { title: 'Final Chapter', content: obj.final_chapter };
                    // Phase 7: manuscript
                    if (typeof obj.final_manuscript === 'string') return { title: 'Final Manuscript', content: obj.final_manuscript };
                    // Generic fields
                    if (typeof obj.result === 'string') return { title: 'Result', content: obj.result };
                    if (typeof obj.output === 'string') return { title: 'Output', content: obj.output };
                    if (typeof obj.content === 'string') return { title: 'Content', content: obj.content };
                    return null;
                  };

                  if (parsedData && typeof parsedData === 'object') {
                    const obj = parsedData as Record<string, unknown>;

                    if (currentPhase === 4) {
                      const sections = [
                        {
                          title: 'Character Profiles',
                          content:
                            typeof obj.character_profiles === 'string'
                              ? obj.character_profiles
                              : typeof obj.characters === 'string'
                                ? obj.characters
                                : '',
                        },
                        { title: 'Worldbuilding', content: typeof obj.worldbuilding === 'string' ? obj.worldbuilding : '' },
                      ].filter((s) => typeof s.content === 'string' && s.content.trim().length > 0);

                      if (sections.length > 0) {
                        return (
                          <div className="space-y-6">
                            {sections.map((s) => (
                              <div key={s.title}>
                                <h4 className="text-sm font-medium mb-2">{s.title}</h4>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">{s.content}</pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    }

                    if (currentPhase === 6) {
                      const sections = [
                        { title: 'Scene Brief', content: typeof obj.scene_brief === 'string' ? obj.scene_brief : '' },
                        { title: 'First Draft', content: typeof obj.first_draft === 'string' ? obj.first_draft : '' },
                        { title: 'Improvement Plan', content: typeof obj.improvement_plan === 'string' ? obj.improvement_plan : '' },
                        { title: 'Final Chapter', content: typeof obj.final_chapter === 'string' ? obj.final_chapter : '' },
                        {
                          title: 'Updated Context Bundle',
                          content: typeof obj.updated_context_bundle === 'string' ? obj.updated_context_bundle : '',
                        },
                      ].filter((s) => typeof s.content === 'string' && s.content.trim().length > 0);

                      if (sections.length > 0) {
                        return (
                          <div className="space-y-6">
                            {sections.map((s) => (
                              <div key={s.title}>
                                <h4 className="text-sm font-medium mb-2">{s.title}</h4>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">{s.content}</pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    }
                  }

                  const extracted = extractContent(parsedData);

                  if (extracted) {
                    return (
                      <div>
                        <h4 className="text-sm font-medium mb-2">{extracted.title}</h4>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">{extracted.content}</pre>
                        </div>
                      </div>
                    );
                  }

                  // Fallback: show raw JSON
                  return (
                    <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">{JSON.stringify(parsedData || {}, null, 2)}</div>
                  );
                })()}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          {completionData && (
            <div className="flex gap-2 mr-auto flex-wrap">
              {/* Phase 1: Save individual or all artifacts */}
              {currentPhase === 1 && completionData.artifacts && (
                <>
                  <Button variant="outline" size="sm" onClick={onSavePhase1ActiveTab}>
                    <Pin className="w-4 h-4 mr-2" />
                    Save {activeTab === 'genre_tropes' ? 'Genre Tropes' : activeTab === 'style_sheet' ? 'Style Sheet' : 'Context Bundle'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onSavePhase1All}>
                    <Pin className="w-4 h-4 mr-2" />Save All
                  </Button>
                </>
              )}
              {/* Phase 2-7: Save result/output */}
              {currentPhase !== 1 && completionData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Parse and extract the actual content
                    let parsedData: unknown = completionData;
                    if (typeof completionData === 'string') {
                      try {
                        parsedData = JSON.parse(completionData);
                      } catch (e) {
                        parsedData = completionData;
                      }
                    }

                    // Extract content based on phase
                    let content = '';
                    let outputName = `Phase ${currentPhase} Output`;

                    if (parsedData && typeof parsedData === 'object') {
                      const obj = parsedData as Record<string, unknown>;

                      if (typeof obj.series_outline === 'string') {
                        content = obj.series_outline;
                        outputName = 'Series Outline';
                      } else if (typeof obj.call_sheet === 'string') {
                        content = obj.call_sheet;
                        outputName = 'Call Sheet';
                      } else if (typeof obj.character_profiles === 'string') {
                        content = obj.character_profiles;
                        outputName = 'Character Profiles';
                      } else if (typeof obj.characters === 'string') {
                        content = obj.characters;
                        outputName = 'Character Profiles';
                      } else if (typeof obj.worldbuilding === 'string') {
                        content = obj.worldbuilding;
                        outputName = 'Worldbuilding';
                      } else if (typeof obj.outline === 'string') {
                        content = obj.outline;
                        outputName = 'Chapter Outline';
                      } else if (typeof obj.chapter_outline === 'string') {
                        content = obj.chapter_outline;
                        outputName = 'Chapter Outline';
                      } else if (typeof obj.scene_brief === 'string') {
                        content = obj.scene_brief;
                        outputName = 'Scene Brief';
                      } else if (typeof obj.first_draft === 'string') {
                        content = obj.first_draft;
                        outputName = 'First Draft';
                      } else if (typeof obj.improvement_plan === 'string') {
                        content = obj.improvement_plan;
                        outputName = 'Improvement Plan';
                      } else if (typeof obj.final_chapter === 'string') {
                        content = obj.final_chapter;
                        outputName = 'Final Chapter';
                      } else if (typeof obj.updated_context_bundle === 'string') {
                        content = obj.updated_context_bundle;
                        outputName = 'Updated Context Bundle';
                      } else if (typeof obj.final_manuscript === 'string') {
                        content = obj.final_manuscript;
                        outputName = 'Final Manuscript';
                      } else if (typeof obj.result === 'string') {
                        content = obj.result;
                      } else if (typeof obj.output === 'string') {
                        content = obj.output;
                      } else if (typeof obj.content === 'string') {
                        content = obj.content;
                      }
                    } else if (typeof parsedData === 'string') {
                      content = parsedData;
                    }

                    if (content) {
                      onSaveOutput(`phase_${currentPhase}_output`, outputName, content);
                    }
                  }}
                >
                  <Pin className="w-4 h-4 mr-2" />
                  Save Output
                </Button>
              )}
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {currentPhase === 5 && onOpenChapterStudio && (
            <Button onClick={onOpenChapterStudio}>
              Open Chapter Studio <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {currentPhase < 7 && currentPhase !== 5 && (
            <Button onClick={onContinue}>
              Continue to Phase {currentPhase + 1} <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
