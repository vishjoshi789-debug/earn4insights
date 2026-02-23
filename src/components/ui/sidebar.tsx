'use client';

import * as React from 'react';
import { PanelLeft } from 'lucide-react';

// simple className join helper
function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type SidebarContextValue = {
  isMobile: boolean;
  isOpen: boolean;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within <SidebarProvider>');
  }
  return ctx;
}

type SidebarProviderProps = {
  children: React.ReactNode;
};

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      setIsOpen(!mobile); // open on desktop, closed on mobile
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value: SidebarContextValue = {
    isMobile,
    isOpen,
    toggle,
  };

  return (
    <SidebarContext.Provider value={value}>
      <div className="flex min-h-screen w-full bg-background">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// The left side rail
type SidebarProps = {
  children: React.ReactNode;
};

export function Sidebar({ children }: SidebarProps) {
  const { isMobile, isOpen, toggle } = useSidebar();

  return (
    <>
      {/* Backdrop overlay on mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 transition-opacity"
          onClick={toggle}
        />
      )}
      <aside
        className={cn(
          'z-40 flex w-64 flex-col border-r bg-card text-card-foreground transition-transform lg:relative lg:translate-x-0',
          isMobile && 'fixed inset-y-0 left-0 shadow-lg',
          isMobile && !isOpen && '-translate-x-full',
          isMobile && isOpen && 'translate-x-0'
        )}
      >
        {children}
      </aside>
    </>
  );
}

// Wrapper for the main content area
type SidebarInsetProps = {
  children: React.ReactNode;
};

export function SidebarInset({ children }: SidebarInsetProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      {children}
    </div>
  );
}

// Structural subcomponents – these are mostly styling wrappers

export function SidebarHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-4">
      {children}
    </div>
  );
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-4">
      {children}
    </div>
  );
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t px-2 py-3">
      {children}
    </div>
  );
}

export function SidebarMenu({ children }: { children: React.ReactNode }) {
  return <nav className="space-y-1">{children}</nav>;
}

export function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

type SidebarMenuButtonProps = {
  children: React.ReactNode;
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
};

export function SidebarMenuButton({
  children,
  asChild,
  isActive,
}: SidebarMenuButtonProps) {
  const baseClasses =
    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ' +
    'hover:bg-accent hover:text-accent-foreground transition-colors';
  const activeClasses = 'bg-accent text-accent-foreground';
  const className = cn(baseClasses, isActive && activeClasses);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      className: cn(
        className,
        (children as React.ReactElement<any>).props.className
      ),
    });
  }

  return (
    <button type="button" className={className}>
      {children}
    </button>
  );
}

// Button used in the header to toggle sidebar on mobile
export function SidebarTrigger() {
  const { toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center rounded-md border bg-background p-2 text-sm hover:bg-accent hover:text-accent-foreground lg:hidden"
    >
      <span className="sr-only">Toggle sidebar</span>
      <PanelLeft className="h-5 w-5" />
    </button>
  );
}
