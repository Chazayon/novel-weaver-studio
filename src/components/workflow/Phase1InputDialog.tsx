import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Phase1FormData {
  genre: string;
  book_title: string;
  initial_ideas: string;
  writing_samples: string;
  outline_template: string;
  prohibited_words: string;
}

interface Phase1InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: Phase1FormData;
  onFormDataChange: (next: Phase1FormData) => void;
  genrePlaceholder: string;
  bookTitlePlaceholder: string;
  onCancel: () => void;
  onSubmit: () => void;
}

export function Phase1InputDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  genrePlaceholder,
  bookTitlePlaceholder,
  onCancel,
  onSubmit,
}: Phase1InputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Phase 1: Initial Setup</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Provide the initial details for your novel. The workflow will use this information to research genre tropes and establish your writing style.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="genre">Genre *</Label>
            <Input
              id="genre"
              placeholder={genrePlaceholder}
              value={formData.genre}
              onChange={(e) => onFormDataChange({ ...formData, genre: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book_title">Book Title *</Label>
            <Input
              id="book_title"
              placeholder={bookTitlePlaceholder}
              value={formData.book_title}
              onChange={(e) => onFormDataChange({ ...formData, book_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_ideas">Initial Ideas *</Label>
            <Textarea
              id="initial_ideas"
              placeholder="Describe your story concept, themes, or any initial ideas you have..."
              value={formData.initial_ideas}
              onChange={(e) => onFormDataChange({ ...formData, initial_ideas: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="writing_samples">Writing Samples (Optional)</Label>
            <Textarea
              id="writing_samples"
              placeholder="Paste a sample of your writing to help establish your style..."
              value={formData.writing_samples}
              onChange={(e) => onFormDataChange({ ...formData, writing_samples: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outline_template">Outline Template Preference (Optional)</Label>
            <Input
              id="outline_template"
              placeholder="e.g., Three-act structure, Hero's Journey, Save the Cat..."
              value={formData.outline_template}
              onChange={(e) => onFormDataChange({ ...formData, outline_template: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prohibited_words">Prohibited Words (Optional)</Label>
            <Input
              id="prohibited_words"
              placeholder="Comma-separated list of words to avoid..."
              value={formData.prohibited_words}
              onChange={(e) => onFormDataChange({ ...formData, prohibited_words: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!formData.initial_ideas}>
            Submit Inputs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
