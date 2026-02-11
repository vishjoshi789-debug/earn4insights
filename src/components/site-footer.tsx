export function SiteFooter() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          &copy; {new Date().getFullYear()} Earn4Insights. All rights reserved.
        </p>
        <nav className="flex gap-4">
          <a href="/about-us" className="text-sm text-purple-700 hover:underline">About Us</a>
          <a href="/contact-us" className="text-sm text-purple-700 hover:underline">Contact Us</a>
        </nav>
      </div>
    </footer>
  );
}
