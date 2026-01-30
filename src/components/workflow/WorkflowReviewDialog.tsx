import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useMemo, useState } from 'react';

interface WorkflowReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  description?: string;
  expectedOutputs?: string[];
  onSubmit: (inputs: Record<string, string>) => void;
}

export function WorkflowReviewDialog({
  open,
  onOpenChange,
  content,
  description,
  expectedOutputs,
  onSubmit,
}: WorkflowReviewDialogProps) {
  const fields = useMemo(
    () => (expectedOutputs && expectedOutputs.length > 0 ? expectedOutputs : ['decision']),
    [expectedOutputs]
  );

  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setInputs({});
      return;
    }
    const next: Record<string, string> = {};
    for (const key of fields) next[key] = '';
    setInputs(next);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setInputs((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const key of fields) {
        if (!(key in next)) next[key] = '';
      }
      return next;
    });
  }, [open, fields]);

  const renderMarkdown = (text: string) => {
    return text
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-2 border-primary pl-4 italic text-muted-foreground my-2">$1</blockquote>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/^---$/gm, '<hr class="my-4 border-border" />')
      .replace(/\n/g, '<br />');
  };

  const decisionOptions = useMemo(() => {
    const label = (description || '').toLowerCase();
    if (label.includes('improvement')) return ['APPLY', 'CUSTOM', 'SKIP'];
    return ['APPROVE', 'REVISE'];
  }, [description]);

  const extraKeys = useMemo(() => {
    const decision = (inputs.decision || '').trim().toUpperCase();
    if (decision === 'REVISE') return ['revision_notes'];
    if (decision === 'CUSTOM') return ['custom_notes'];
    return [];
  }, [inputs.decision]);

  const isSubmitDisabled = useMemo(() => {
    // Only require the workflow-declared expected outputs.
    // Extra keys (like revision_notes/custom_notes) are UX helpers and should not block submission.
    return fields.some((k) => (inputs[k] || '').trim().length === 0);
  }, [fields, inputs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Workflow Output</DialogTitle>
          <DialogDescription>
            {description || 'Please review the generated content and approve or request revisions.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          </div>
        </ScrollArea>

        {fields.length > 0 && (
          <div className="space-y-4">
            {fields.includes('decision') && (
              <div className="flex flex-wrap gap-2">
                {decisionOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInputs((prev) => ({ ...prev, decision: opt }));
                      // If the only required field is decision, allow single-click submit.
                      if (fields.length === 1 && fields[0] === 'decision' && opt !== 'REVISE' && opt !== 'CUSTOM') {
                        onSubmit({ decision: opt });
                      }
                    }}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            {fields.filter((key) => key !== 'decision').map((key) => (
              <div key={key} className="space-y-2">
                <div className="text-sm font-medium">{key}</div>
                {key === 'revision_notes' || key === 'custom_notes' ? (
                  <Textarea
                    value={inputs[key] || ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="min-h-[120px]"
                  />
                ) : (
                  <Input
                    value={inputs[key] || ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {extraKeys.filter((key) => !fields.includes(key)).map((key) => (
              <div key={key} className="space-y-2">
                <div className="text-sm font-medium">{key}</div>
                <Textarea
                  value={inputs[key] || ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="min-h-[120px]"
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const payload: Record<string, string> = {};
              for (const key of fields) payload[key] = inputs[key] || '';
              for (const key of extraKeys) payload[key] = inputs[key] || '';
              onSubmit(payload);
            }}
            disabled={fields.length === 0 || isSubmitDisabled}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
