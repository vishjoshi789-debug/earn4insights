export function SiteFooter() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          &copy; {new Date().getFullYear()} Brand Pulse. All rights reserved.
        </p>
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built with passion.
        </p>
      </div>
    </footer>
  );
}
