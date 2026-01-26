import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Copy, Save, History, ArrowLeftRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EditorTabsProps {
  sceneBrief: string;
  draft: string;
  improvePlan: string;
  final: string;
  onSave?: (tab: string, content: string) => void;
}

export function EditorTabs({ sceneBrief, draft, improvePlan, final, onSave }: EditorTabsProps) {
  const [activeTab, setActiveTab] = useState('scene-brief');
  const [showDiff, setShowDiff] = useState(false);

  const tabs = [
    { id: 'scene-brief', label: 'Scene Brief', content: sceneBrief },
    { id: 'draft', label: 'Draft', content: draft },
    { id: 'improve-plan', label: 'Improvement Plan', content: improvePlan },
    { id: 'final', label: 'Final', content: final },
  ];

  return (
    <div className="glass-card h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        {/* Tab header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <TabsList className="bg-muted/50">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Toolbar */}
          <div className="flex items-center gap-1">
            {activeTab === 'final' && (
              <Button
                variant={showDiff ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
              >
                <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                Diff View
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tab content */}
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="flex-1 p-4 overflow-y-auto"
          >
            {showDiff && tab.id === 'final' ? (
              // Diff view placeholder
              <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Draft</span>
                  <div className="p-4 rounded-lg bg-muted/30 h-full overflow-y-auto">
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                      {draft || 'No draft content yet...'}
                    </pre>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Final</span>
                  <div className="p-4 rounded-lg bg-muted/30 h-full overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {final || 'No final content yet...'}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                {tab.content ? (
                  <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                    {tab.content}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No content yet. Run the pipeline to generate this section.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
