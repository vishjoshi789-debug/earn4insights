'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { User, Bell, MessageSquareText } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/Tooltip';
import { LogoutButton } from './logout-button';

export function SiteHeader() {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2 group">
          <Logo />
          <span className="font-bold font-headline text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent group-hover:from-accent group-hover:via-primary group-hover:to-accent transition-all">
            Earn4Insights
          </span>
        </Link>
        <nav className="hidden flex-1 items-center gap-6 text-sm md:flex">
          <Link
            href="/top-products"
            className="font-medium transition-colors hover:text-primary"
          >
            Rankings
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
                        <AvatarImage src="/avatars/01.png" alt={user.name} />
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