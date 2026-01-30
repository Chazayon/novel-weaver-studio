import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChapterDetail } from '@/api/types';

interface Phase6FormData {
  chapter_number: string;
  chapter_title: string;
}

interface Phase6InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: Phase6FormData;
  onFormDataChange: (next: Phase6FormData) => void;
  chapters: ChapterDetail[];
  showChapterSelector: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function Phase6InputDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  chapters,
  showChapterSelector,
  onCancel,
  onSubmit,
}: Phase6InputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Phase 6: Chapter Writing</DialogTitle>
          <DialogDescription>
            Provide the chapter details to generate scene brief, draft, and final version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {showChapterSelector && chapters.length > 0 && (
            <div className="space-y-2">
              <Label>Choose Chapter</Label>
              <Select
                value={formData.chapter_number}
                onValueChange={(val) => {
                  const num = Number(val);
                  const ch = chapters.find((c) => c.number === num);
                  onFormDataChange({
                    chapter_number: String(val),
                    chapter_title: ch?.title || '',
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => (
                    <SelectItem key={c.number} value={String(c.number)}>
                      Chapter {c.number}: {c.title} {c.status === 'completed' ? '✅' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {chapters.filter((c) => c.status === 'completed').length}/{chapters.length} completed
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="chapter_number">Chapter Number *</Label>
            <Input
              id="chapter_number"
              type="number"
              min="1"
              placeholder="Enter chapter number (e.g., 1)"
              value={formData.chapter_number}
              onChange={(e) => onFormDataChange({ ...formData, chapter_number: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter_title">Chapter Title *</Label>
            <Input
              id="chapter_title"
              placeholder="Enter the chapter title"
              value={formData.chapter_title}
              onChange={(e) => onFormDataChange({ ...formData, chapter_title: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!formData.chapter_title}>
            Submit Inputs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
