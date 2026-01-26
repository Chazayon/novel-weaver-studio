import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { mockChapters } from '@/lib/mockData';
import { 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileText, 
  FileDown,
  ScrollText,
  Sparkles
} from 'lucide-react';

export default function CompileExport() {
  const [chapters] = useState(mockChapters);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [isCompiled, setIsCompiled] = useState(false);

  const completedChapters = chapters.filter(c => c.final === 'completed');
  const allComplete = completedChapters.length === chapters.length;
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  const handleCompile = () => {
    setIsCompiling(true);
    setCompileProgress(0);
    
    const interval = setInterval(() => {
      setCompileProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCompiling(false);
          setIsCompiled(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const mockManuscript = `# The Forgotten Kingdom
### A Novel by Jane Doe

---

## Chapter 1: The Awakening

The great doors of Castle Thornwood groaned as Elena pushed through them, her heart hammering against her ribs...

[Chapter 1 content continues...]

---

## Chapter 2: Into the Unknown

Dawn broke over the eastern mountains, painting the sky in shades of amber and rose...

[Chapter 2 content continues...]

---

## Chapter 3: The First Trial

The arena was smaller than Elena had imagined. Stone walls rose on all sides, ancient and weathered...

[Chapter 3 content continues...]

---

*[Additional chapters would follow...]*`;

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold mb-4">
            <span className="gradient-text">Final Compilation</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Compile all your chapters into the final manuscript and export to your preferred format.
          </p>
        </div>

        {/* Completion checklist */}
        <div className="glass-card p-6 mb-8">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            Completion Checklist
          </h2>

          <div className="space-y-3 mb-6">
            {chapters.map((chapter) => {
              const isComplete = chapter.final === 'completed';
              return (
                <div
                  key={chapter.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-status-warning shrink-0" />
                  )}
                  <span className={isComplete ? 'text-foreground' : 'text-muted-foreground'}>
                    Chapter {chapter.number}: {chapter.title}
                  </span>
                  {chapter.wordCount > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {chapter.wordCount.toLocaleString()} words
                    </span>
                  )}
                  <Badge variant={isComplete ? 'success' : 'muted'}>
                    {isComplete ? 'Complete' : 'Pending'}
                  </Badge>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-lg font-semibold">
                {completedChapters.length} of {chapters.length} chapters ready
              </span>
              <p className="text-sm text-muted-foreground">
                Total: {totalWords.toLocaleString()} words
              </p>
            </div>
            <Badge variant={allComplete ? 'success' : 'warning'} className="text-sm px-3 py-1">
              {allComplete ? 'Ready to Compile' : 'Chapters Pending'}
            </Badge>
          </div>
        </div>

        {/* Compile action */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold mb-1">Compile Manuscript</h2>
              <p className="text-sm text-muted-foreground">
                Merge all chapters into a single manuscript file
              </p>
            </div>
            <Button 
              size="lg" 
              onClick={handleCompile}
              disabled={isCompiling || !allComplete}
            >
              {isCompiling ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Compiling...
                </>
              ) : isCompiled ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Compiled!
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Compile Manuscript
                </>
              )}
            </Button>
          </div>

          {isCompiling && (
            <div className="space-y-2">
              <Progress value={compileProgress} className="h-2 bg-muted" />
              <p className="text-sm text-muted-foreground text-center">
                Compiling chapters... {compileProgress}%
              </p>
            </div>
          )}

          {!allComplete && !isCompiling && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
              <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
              <span className="text-sm text-status-warning">
                Complete all chapters before compiling the manuscript
              </span>
            </div>
          )}
        </div>

        {/* Preview & Export */}
        {isCompiled && (
          <div className="space-y-6 animate-fade-in">
            {/* Preview */}
            <div className="glass-card p-6">
              <h2 className="font-display text-xl font-semibold mb-4">Manuscript Preview</h2>
              <div className="bg-muted/30 rounded-lg p-6 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed">
                  {mockManuscript}
                </pre>
              </div>
            </div>

            {/* Export options */}
            <div className="glass-card p-6">
              <h2 className="font-display text-xl font-semibold mb-4">Export Options</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  <span>Markdown</span>
                  <span className="text-xs text-muted-foreground">.md</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileDown className="w-6 h-6 text-secondary" />
                  <span>Word Document</span>
                  <span className="text-xs text-muted-foreground">.docx</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Download className="w-6 h-6 text-status-success" />
                  <span>PDF</span>
                  <span className="text-xs text-muted-foreground">.pdf</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Export functionality will be connected to the backend in a future update
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
