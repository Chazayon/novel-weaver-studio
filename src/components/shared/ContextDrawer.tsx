import { useState } from 'react';
import { Artifact } from '@/lib/mockData';
import { ArtifactCard } from './ArtifactCard';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen, Pin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ContextDrawerProps {
  artifacts: Artifact[];
  isOpen: boolean;
  onToggle: () => void;
}

export function ContextDrawer({ artifacts, isOpen, onToggle }: ContextDrawerProps) {
  const [search, setSearch] = useState('');

  const pinnedArtifacts = artifacts.filter(a => a.pinned);
  const otherArtifacts = artifacts.filter(a => !a.pinned);
  
  const filteredPinned = pinnedArtifacts.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOther = otherArtifacts.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Toggle button when closed */}
      {!isOpen && (
        <Button
          variant="glass"
          size="icon"
          className="fixed right-4 top-20 z-40"
          onClick={onToggle}
        >
          <PanelRightOpen className="w-4 h-4" />
        </Button>
      )}

      {/* Drawer */}
      <div className={cn(
        "fixed right-0 top-16 bottom-0 w-80 border-l border-border bg-sidebar/95 backdrop-blur-xl z-40 transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold">Context</h3>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search artifacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Pinned section */}
          {filteredPinned.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pinned
                </span>
              </div>
              <div className="space-y-2">
                {filteredPinned.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
                ))}
              </div>
            </div>
          )}

          {/* Other artifacts */}
          {filteredOther.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                All Artifacts
              </span>
              <div className="space-y-2 mt-3">
                {filteredOther.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} compact />
                ))}
              </div>
            </div>
          )}

          {filteredPinned.length === 0 && filteredOther.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No artifacts found
            </div>
          )}
        </div>
      </div>
    </>
  );
}
