import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PhaseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseToRun: number | null;
  phaseDescription: string;
  phaseDuration: string;
  showPhase1Hint: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PhaseConfirmDialog({
  open,
  onOpenChange,
  phaseToRun,
  phaseDescription,
  phaseDuration,
  showPhase1Hint,
  onCancel,
  onConfirm,
}: PhaseConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start Phase {phaseToRun}?</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">{phaseDescription}</p>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">This will:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Start the automated workflow</li>
              <li>• Estimated time: {phaseDuration}</li>
              {showPhase1Hint && <li>• Request your input for genre, title, and ideas</li>}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Start Workflow</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
