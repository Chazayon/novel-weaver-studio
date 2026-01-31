import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Home, Layers, FileText, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: Home, label: 'Projects' },
  { path: '/cockpit', icon: Layers, label: 'Workflow' },
  { path: '/chapter-studio', icon: FileText, label: 'Chapter Studio' },
  { path: '/compile', icon: Download, label: 'Compile' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  return (
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Animated gradient orbs */}
      <div className="gradient-orb gradient-orb-primary" />
      <div className="gradient-orb gradient-orb-secondary" />

      {/* Top navigation bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-display font-semibold gradient-text">Novel Studio</span>
              <span className="text-[10px] text-muted-foreground -mt-1">AI Writing Cockpit</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* AI Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">Local Backend Ready</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-16 flex-1 min-h-0 flex flex-col relative z-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
