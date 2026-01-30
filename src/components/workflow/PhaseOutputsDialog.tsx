import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

interface PhaseOutputsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: number;
  phaseName: string;
  content: string;
  onClose: () => void;
  onEdit: () => void;
}

export function PhaseOutputsDialog({
  open,
  onOpenChange,
  phaseId,
  phaseName,
  content,
  onClose,
  onEdit,
}: PhaseOutputsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Phase {phaseId} Outputs: {phaseName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">{content}</pre>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>
            <Edit className="w-4 h-4" />
            Edit in Editor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
