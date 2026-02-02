import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Save, ArrowLeftRight, Check, Edit2, Download, Loader2, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface EditorTabsProps {
  sceneBrief: string;
  draft: string;
  improvePlan: string;
  final: string;
  onSave?: (tab: string, content: string) => void;
  onApprove?: (tab: string, content: string) => void;
  onPromoteToNext?: (fromTab: string) => void;
  onSaveAsFinal?: (content: string) => void;
  onGenerateStep?: (step: string) => void;
  projectId?: string;
  chapterNumber?: number;
  isGenerating?: boolean;
}

export function EditorTabs({ 
  sceneBrief, 
  draft, 
  improvePlan, 
  final, 
  onSave,
  onApprove,
  onPromoteToNext,
  onSaveAsFinal,
  onGenerateStep,
  projectId,
  chapterNumber,
  isGenerating = false
}: EditorTabsProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('scene-brief');
  const [showDiff, setShowDiff] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  
  // Track approval status for each artifact
  const [approvedTabs, setApprovedTabs] = useState<Set<string>>(new Set());

  const approvalStorageKey = useMemo(() => {
    if (!projectId || !chapterNumber) return null;
    return `novel-weaver:chapter-studio:approved:${projectId}:ch${chapterNumber}`;
  }, [projectId, chapterNumber]);

  useEffect(() => {
    if (!approvalStorageKey) return;
    try {
      const raw = localStorage.getItem(approvalStorageKey);
      if (!raw) {
        setApprovedTabs(new Set());
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setApprovedTabs(new Set(parsed.map(String)));
      }
    } catch {
      setApprovedTabs(new Set());
    }
  }, [approvalStorageKey]);

  useEffect(() => {
    if (!approvalStorageKey) return;
    try {
      localStorage.setItem(approvalStorageKey, JSON.stringify(Array.from(approvedTabs)));
    } catch {
      // ignore
    }
  }, [approvalStorageKey, approvedTabs]);
  
  // Initialize edited content when props change
  useEffect(() => {
    setEditedContent({
      'scene-brief': sceneBrief,
      'draft': draft,
      'improve-plan': improvePlan,
      'final': final,
    });
  }, [sceneBrief, draft, improvePlan, final]);

  const tabs = [
    { id: 'scene-brief', label: 'Scene Brief', content: editedContent['scene-brief'] || '', nextTab: 'draft' },
    { id: 'draft', label: 'Draft', content: editedContent['draft'] || '', nextTab: 'improve-plan' },
    { id: 'improve-plan', label: 'Improvement Plan', content: editedContent['improve-plan'] || '', nextTab: 'final' },
    { id: 'final', label: 'Final', content: editedContent['final'] || '', nextTab: null },
  ];
  
  const currentTab = tabs.find(t => t.id === activeTab);
  const currentContent = currentTab?.content || '';
  const hasUnsavedChanges = editedContent[activeTab] !== getOriginalContent(activeTab);
  
  function getOriginalContent(tabId: string): string {
    switch(tabId) {
      case 'scene-brief': return sceneBrief;
      case 'draft': return draft;
      case 'improve-plan': return improvePlan;
      case 'final': return final;
      default: return '';
    }
  }
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    if (onSave) {
      onSave(activeTab, editedContent[activeTab] || '');
      toast({ title: 'Saved', description: `${currentTab?.label} has been saved.` });
    }
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditedContent(prev => ({
      ...prev,
      [activeTab]: getOriginalContent(activeTab)
    }));
    setIsEditing(false);
  };
  
  const handleApprove = () => {
    if (onApprove) {
      onApprove(activeTab, editedContent[activeTab] || '');
    }
    setApprovedTabs(prev => new Set(prev).add(activeTab));
    toast({ 
      title: 'Approved', 
      description: `${currentTab?.label} has been approved and saved.` 
    });
  };
  
  const handlePromoteToNext = () => {
    if (currentTab?.nextTab && onPromoteToNext) {
      onPromoteToNext(activeTab);
      setActiveTab(currentTab.nextTab);
      toast({ 
        title: 'Promoted', 
        description: `Moving to ${tabs.find(t => t.id === currentTab.nextTab)?.label}` 
      });
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    toast({ title: 'Copied', description: 'Content copied to clipboard' });
  };
  
  const handleDownload = () => {
    if (activeTab === 'final' && onSaveAsFinal) {
      onSaveAsFinal(currentContent);
      toast({ title: 'Saved', description: `Chapter saved as chapter_${chapterNumber}_final.md` });
    }
  };

  // Determine next action based on current tab and content
  const getNextAction = () => {
    if (!currentContent && onGenerateStep) {
      if (activeTab === 'draft') {
        const hasSceneBrief = !!(editedContent['scene-brief'] || '').trim();
        const sceneBriefApproved = approvedTabs.has('scene-brief');
        if (!hasSceneBrief || !sceneBriefApproved) {
          return {
            label: 'Complete Scene Brief First',
            action: () => {
              setActiveTab('scene-brief');
              toast({
                title: 'Next step',
                description: 'Generate and approve the Scene Brief before drafting.'
              });
            },
            variant: 'secondary' as const,
          };
        }
      }

      if (activeTab === 'improve-plan') {
        const hasDraft = !!(editedContent['draft'] || '').trim();
        const draftApproved = approvedTabs.has('draft');
        if (!hasDraft || !draftApproved) {
          return {
            label: 'Complete Draft First',
            action: () => {
              setActiveTab('draft');
              toast({
                title: 'Next step',
                description: 'Generate and approve the Draft before creating an improvement plan.'
              });
            },
            variant: 'secondary' as const,
          };
        }
      }

      if (activeTab === 'final') {
        const hasDraft = !!(editedContent['draft'] || '').trim();
        const draftApproved = approvedTabs.has('draft');
        if (!hasDraft || !draftApproved) {
          return {
            label: 'Complete Draft First',
            action: () => {
              setActiveTab('draft');
              toast({
                title: 'Next step',
                description: 'Generate and approve the Draft before generating the Final.'
              });
            },
            variant: 'secondary' as const,
          };
        }

        const hasImprovePlan = !!(editedContent['improve-plan'] || '').trim();
        const improvePlanApproved = approvedTabs.has('improve-plan');
        if (hasImprovePlan && !improvePlanApproved) {
          return {
            label: 'Review Improvement Plan First',
            action: () => {
              setActiveTab('improve-plan');
              toast({
                title: 'Next step',
                description: 'Review and approve the Improvement Plan before generating the Final.'
              });
            },
            variant: 'secondary' as const,
          };
        }
      }

      return {
        label: `Generate ${currentTab?.label}`,
        action: () => onGenerateStep(activeTab),
        variant: 'default' as const
      };
    }
    if (currentContent && !approvedTabs.has(activeTab)) {
      return {
        label: `Review & Approve`,
        action: handleApprove,
        variant: 'default' as const
      };
    }
    if (currentTab?.nextTab && approvedTabs.has(activeTab)) {
      return {
        label: `Continue to ${tabs.find(t => t.id === currentTab.nextTab)?.label}`,
        action: handlePromoteToNext,
        variant: 'default' as const
      };
    }
    return null;
  };
  
  const nextAction = getNextAction();

  const renderPrimaryAction = (size: 'sm' | 'lg') => {
    if (!nextAction || isEditing) return null;
    const shouldAnimate = !isGenerating && nextAction.variant === 'default';
    return (
      <motion.div
        animate={shouldAnimate ? {
          boxShadow: [
            '0 0 20px hsl(var(--primary) / 0.3)',
            '0 0 35px hsl(var(--primary) / 0.5)',
            '0 0 20px hsl(var(--primary) / 0.3)'
          ]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Button
          size={size}
          onClick={nextAction.action}
          disabled={isGenerating}
          variant={nextAction.variant === 'default' ? 'glow' : nextAction.variant}
        >
          {isGenerating ? (
            <>
              <Loader2 className={size === 'lg' ? 'w-4 h-4 mr-2 animate-spin' : 'w-4 h-4 mr-2 animate-spin'} />
              {nextAction.label.startsWith('Generate') ? 'Generating...' : 'Working...'}
            </>
          ) : (
            nextAction.label
          )}
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setIsEditing(false); }} className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Tab header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
          <TabsList className="bg-muted/50">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-primary relative px-4 py-2"
              >
                {tab.label}
                {approvedTabs.has(tab.id) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1"
                  >
                    <Check className="w-3 h-3 text-status-success drop-shadow-lg" />
                  </motion.div>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleCopy} disabled={!currentContent}>
                  <Copy className="w-4 h-4" />
                </Button>
                {currentContent && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleEdit}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {activeTab === 'final' && currentContent && (
                  <Button
                    variant={showDiff ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setShowDiff(!showDiff)}
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                    Compare
                  </Button>
                )}
                {renderPrimaryAction('sm')}
              </>
            )}
          </div>
        </div>

        {/* Tab content */}
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="flex-1 mt-0 p-0 overflow-hidden min-h-0"
          >
            <div className="h-full flex flex-col min-h-0">
              {showDiff && tab.id === 'final' ? (
                // Diff view
                <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
                  <div className="space-y-2 flex flex-col overflow-hidden">
                    <span className="text-xs font-medium text-muted-foreground">Draft</span>
                    <div className="p-4 rounded-lg bg-muted/30 flex-1 overflow-y-auto">
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                        {draft || 'No draft content yet...'}
                      </pre>
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col overflow-hidden">
                    <span className="text-xs font-medium text-muted-foreground">Final</span>
                    <div className="p-4 rounded-lg bg-muted/30 flex-1 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {final || 'No final content yet...'}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : isEditing && tab.id === activeTab ? (
                // Edit mode
                <div className="flex-1 flex flex-col overflow-hidden p-6">
                  <Textarea
                    value={editedContent[activeTab] || ''}
                    onChange={(e) => setEditedContent(prev => ({ ...prev, [activeTab]: e.target.value }))}
                    className="flex-1 font-mono text-base resize-none bg-muted/30 border-muted"
                    placeholder={`Edit ${tab.label}...`}
                  />
                </div>
              ) : (
                // View mode
                <div className="flex-1 flex flex-col overflow-hidden">
                  {tab.content ? (
                    <div className="flex-1 overflow-y-auto px-8 py-6">
                      <div className="max-w-4xl mx-auto">
                        <pre className="whitespace-pre-wrap font-sans text-base text-foreground leading-loose">
                          {tab.content}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center max-w-md px-6">
                        <div className="mb-4">
                          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">No {tab.label} Yet</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          {activeTab === 'scene-brief' && "Start by generating a scene brief to outline the key moments and narrative flow of this chapter."}
                          {activeTab === 'draft' && "Once the scene brief is approved, you can generate the first draft of your chapter."}
                          {activeTab === 'improve-plan' && "After reviewing the draft, generate an improvement plan to refine your chapter."}
                          {activeTab === 'final' && "Apply the improvements to create the final version of your chapter."}
                        </p>
                        {nextAction && (
                          <Button 
                            size="lg" 
                            onClick={nextAction.action}
                            disabled={isGenerating}
                            variant={nextAction.variant}
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              nextAction.label
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!isEditing && (
                    <div className="border-t border-border bg-muted/30 px-6 py-4">
                      <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {currentContent ? (
                            approvedTabs.has(activeTab) ? (
                              <span className="flex items-center gap-2 text-status-success">
                                <Check className="w-4 h-4" />
                                Approved and ready
                              </span>
                            ) : (
                              "Review the content and approve to continue"
                            )
                          ) : (
                            "Generate an initial version to begin reviewing"
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {activeTab === 'draft' && approvedTabs.has('draft') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab('final')}
                            >
                              Skip to Final
                            </Button>
                          )}
                          {activeTab === 'final' && currentContent && (
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                              <Download className="w-4 h-4 mr-1.5" />
                              Save as Final
                            </Button>
                          )}
                          {renderPrimaryAction('sm')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
