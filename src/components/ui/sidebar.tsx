// src/components/ui/sidebar.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SidebarContextValue = {
  open: boolean;
  toggle: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  isMobile: boolean; 
};

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined
);

/**
 * Hook used by components (like SidebarTrigger) to read/toggle sidebar state.
 */
export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a <SidebarProvider>.");
  }
  return ctx;
}

/**
 * Provider that owns the open/closed state for the sidebar.
 * Wrap your layout or app shell with this if you use useSidebar().
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isMobile = false; // placeholder for now

  const value = useMemo(
    () => ({
      open,
      toggle: () => setOpen((prev) => !prev),
      openSidebar: () => setOpen(true),
      closeSidebar: () => setOpen(false),
      isMobile,
    }),
    [open,  isMobile ]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * A simple trigger button that toggles the sidebar open/closed.
 * It uses the useSidebar() hook internally.
 */
export function SidebarTrigger(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { toggle } = useSidebar();

  const { className, children, ...rest } = props;

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? "inline-flex items-center gap-2 p-2 rounded border"}
      {...rest}
    >
      {children ?? "Toggle sidebar"}
    </button>
  );
}

// Optional default export to make the file an obvious module.
// You can use <SidebarProvider> at the top-level layout if needed.
export default SidebarProvider;
