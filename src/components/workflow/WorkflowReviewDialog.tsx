import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface WorkflowReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  description?: string;
  onReject: () => void;
  onApprove: () => void;
}

export function WorkflowReviewDialog({
  open,
  onOpenChange,
  content,
  description,
  onReject,
  onApprove,
}: WorkflowReviewDialogProps) {
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
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{content}</pre>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onReject}>
            Request Revisions
          </Button>
          <Button onClick={onApprove}>Approve &amp; Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
