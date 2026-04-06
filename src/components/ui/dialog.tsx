"use client";

import * as React from "react";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/**
 * Root Dialog component.
 * Holds open/close state and provides it to children through context.
 */
export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const value = React.useMemo(
    () => ({
      open: Boolean(actualOpen),
      setOpen,
    }),
    [actualOpen]
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

/**
 * Optional trigger button that opens the dialog when clicked.
 */
export type DialogTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

export function DialogTrigger({ children, onClick, asChild, ...rest }: DialogTriggerProps) {
  const ctx = React.useContext(DialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented && ctx) {
      ctx.setOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}

type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean;
};

/**
 * Content of the dialog. Only renders when open.
 * You can style this with Tailwind where it’s used.
 */
export function DialogContent({ children, className, ...rest }: DialogContentProps) {
  const ctx = React.useContext(DialogContext);

  if (!ctx || !ctx.open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      {...rest}
    >
      <div className={`w-full rounded-lg bg-card text-card-foreground border border-border p-6 shadow-lg ${className ?? 'max-w-lg'}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Simple structural helpers for building dialog layout.
 */

type DialogSectionProps = React.HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...rest }: DialogSectionProps) {
  return <div className={className ?? "mb-4"} {...rest} />;
}

export function DialogFooter({ className, ...rest }: DialogSectionProps) {
  return <div className={className ?? "mt-4 flex justify-end gap-2"} {...rest} />;
}

export function DialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  const { className, ...rest } = props;
  return <h2 className={className ?? "text-lg font-semibold"} {...rest} />;
}

export function DialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  const { className, ...rest } = props;
  return (
    <p className={className ?? "mt-1 text-sm text-muted-foreground"} {...rest} />
  );
}

/**
 * Optional close button component that can be used inside the dialog.
 */
export type DialogCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function DialogClose({ children, onClick, ...rest }: DialogCloseProps) {
  const ctx = React.useContext(DialogContext);

  if (!ctx) {
    return (
      <button type="button" onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          ctx.setOpen(false);
        }
      }}
      {...rest}
    >
      {children ?? "Close"}
    </button>
  );
}

// Default export (optional, to ensure file is clearly a module)
const DialogModule = {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
