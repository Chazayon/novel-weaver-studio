import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Artifact } from '@/lib/mockData';
import { Copy, Pin } from 'lucide-react';

interface ArtifactViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: Artifact | null;
  onTogglePin: () => void;
  onCopy: () => void;
}

export function ArtifactViewDialog({
  open,
  onOpenChange,
  artifact,
  onTogglePin,
  onCopy,
}: ArtifactViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            {artifact?.name}
            {artifact?.pinned && (
              <Badge variant="outline" className="text-xs">
                <Pin className="w-3 h-3 mr-1" />
                Pinned
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Review and manage this artifact</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[500px]">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">
              {artifact?.content || 'No content available'}
            </pre>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onTogglePin}>
            <Pin className="w-4 h-4 mr-2" />
            {artifact?.pinned ? 'Remove from Context' : 'Save to Context'}
          </Button>
          <Button variant="outline" onClick={onCopy}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Content
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
