'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  onOpenChange: () => {},
});

function useSheet() {
  return React.useContext(SheetContext);
}

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open = false, onOpenChange = () => {}, children }: SheetProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

interface SheetTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

function SheetTrigger({ asChild, children }: SheetTriggerProps) {
  const { onOpenChange } = useSheet();
  const handleClick = () => onOpenChange(true);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

function SheetContent({
  children,
  className,
  side = 'right',
}: SheetContentProps) {
  const { open, onOpenChange } = useSheet();

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const sideClasses = {
    right: 'inset-y-0 right-0 w-3/4 max-w-sm border-l animate-in slide-in-from-right',
    left: 'inset-y-0 left-0 w-3/4 max-w-sm border-r animate-in slide-in-from-left',
    top: 'inset-x-0 top-0 h-auto border-b animate-in slide-in-from-top',
    bottom: 'inset-x-0 bottom-0 h-auto border-t animate-in slide-in-from-bottom',
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          'fixed z-[101] flex flex-col bg-background p-6 shadow-lg overflow-y-auto',
          sideClasses[side],
          className,
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </>,
    document.body
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props} />
  );
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle };
