import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface CollapsiblePanelProps {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
  children: ReactNode;
  className?: string;
}

export function CollapsiblePanel({
  title,
  icon,
  isOpen,
  onToggle,
  side,
  children,
  className,
}: CollapsiblePanelProps) {
  const isLeft = side === 'left';

  return (
    <>
      {/* Collapsed state - vertical label strip */}
      {!isOpen && (
        <div
          className={cn(
            "shrink-0 w-10 lg:w-12 bg-sidebar/80 backdrop-blur-xl border-border flex flex-col items-center py-3 lg:py-4 cursor-pointer hover:bg-sidebar transition-colors",
            isLeft ? "border-r" : "border-l",
            className
          )}
          onClick={onToggle}
        >
          {/* Toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-muted/50 hover:bg-muted mb-3 lg:mb-4"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isLeft ? (
              <ChevronRight className="w-4 h-4 text-primary" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-primary" />
            )}
          </Button>

          {/* Icon */}
          {icon && (
            <div className="text-primary mb-2 lg:mb-3">
              {icon}
            </div>
          )}

          {/* Vertical label */}
          <div 
            className="writing-vertical text-xs lg:text-sm font-medium text-muted-foreground tracking-wider uppercase"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {title}
          </div>
        </div>
      )}

      {/* Expanded state */}
      {isOpen && (
        <div
          className={cn(
            "shrink-0 w-64 lg:w-80 bg-sidebar/50 backdrop-blur-xl flex flex-col transition-all duration-300",
            isLeft ? "border-r border-border" : "border-l border-border",
            className
          )}
        >
          {/* Header with collapse button */}
          <div className="flex items-center justify-between p-3 lg:p-4 border-b border-border">
            {isLeft ? (
              <>
                <h3 className="font-display text-base lg:text-lg font-semibold flex items-center gap-2">
                  {icon && <span className="text-primary">{icon}</span>}
                  {title}
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <h3 className="font-display text-base lg:text-lg font-semibold flex items-center gap-2">
                  {icon && <span className="text-primary">{icon}</span>}
                  {title}
                </h3>
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </>
  );
}
