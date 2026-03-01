'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Bell, MessageSquareText, Menu, LayoutDashboard, Package, MessageSquare, BarChart3, Award, Users, HandCoins, MessagesSquare, FileText, Trophy, TrendingUp, PackagePlus, Settings } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { LogoutButton } from './logout-button';

export function SiteHeader() {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const user = session?.user;
  const pathname = usePathname();

  // Hide SiteHeader on dashboard routes (dashboard has its own header)
  if (pathname?.startsWith('/dashboard')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {/* Mobile hamburger menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Logo size={36} />
                    <span className="font-bold font-headline text-lg">Earn4Insights</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-normal leading-tight pl-1">
                    Real Voices. Measurable Intelligence.
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-6 overflow-y-auto">
              {/* Public Pages */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Explore</p>
              <MobileNavLink href="/top-products" icon={Trophy} label="Rankings" onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/submit-feedback" icon={MessageSquare} label="Submit Feedback" onClick={() => setMobileMenuOpen(false)} />
              <MobileNavLink href="/community" icon={MessagesSquare} label="Community" onClick={() => setMobileMenuOpen(false)} />

              {user && (
                <>
                  <div className="border-t my-3" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Dashboard</p>
                  <MobileNavLink href="/dashboard" icon={LayoutDashboard} label="Overview" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/products" icon={Package} label="Products" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/rankings" icon={Trophy} label="Weekly Top 10" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/feedback" icon={MessageSquare} label="Feedback" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/social" icon={Users} label="Social" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/community" icon={MessagesSquare} label="Community" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/surveys" icon={BarChart3} label="Surveys & NPS" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/analytics/unified" icon={TrendingUp} label="Unified Analytics" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/rewards" icon={Award} label="Rewards" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/payouts" icon={HandCoins} label="Payouts" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/detailed-analytics" icon={FileText} label="Detailed Analytics" onClick={() => setMobileMenuOpen(false)} />
                  <MobileNavLink href="/dashboard/launch" icon={PackagePlus} label="Launch Product" onClick={() => setMobileMenuOpen(false)} />

                  <div className="border-t my-3" />
                  <MobileNavLink href="/dashboard/settings" icon={Settings} label="Settings" onClick={() => setMobileMenuOpen(false)} />
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="mr-6 flex items-center space-x-2 group">
          <Logo size={36} />
          <div className="flex flex-col">
            <span className="font-bold font-headline text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent group-hover:from-accent group-hover:via-primary group-hover:to-accent transition-all leading-tight">
              Earn4Insights
            </span>
            <span className="text-[9px] text-muted-foreground leading-tight">
              Real Voices. Measurable Intelligence.
            </span>
          </div>
        </Link>
        <nav className="hidden flex-1 items-center gap-6 text-sm md:flex">
          <Link
            href="/top-products"
            className="font-medium transition-colors hover:text-primary"
          >
            Rankings
          </Link>
          <Link
            href="/submit-feedback"
            className="font-medium transition-colors hover:text-primary"
          >
            Submit Feedback
          </Link>
          <Link
            href="/community"
            className="font-medium transition-colors hover:text-primary"
          >
            Community
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {status === 'loading' ? null : !user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="font-semibold">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold shadow-sm hover:shadow-md">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          ) : (
            <TooltipProvider>
            <DropdownMenu
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary"></span>
                      <span className="sr-only">Notifications</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notifications</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/surveys"
                    className="flex items-start gap-3"
                  >
                    <MessageSquareText className="text-primary mt-1" />
                    <div className="grid gap-0.5">
                      <p className="font-medium">New Survey Available</p>
                      <p className="text-xs text-muted-foreground">
                        Share your feedback on our Q2 Product Satisfaction
                        survey.
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full hover:bg-accent hover:text-accent-foreground"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/avatars/01.png" alt={user.name || undefined} />
                        <AvatarFallback>
                          <User />
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>My Account</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <LogoutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
          )}
        </div>
      </div>
    </header>
  );
}

function MobileNavLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}