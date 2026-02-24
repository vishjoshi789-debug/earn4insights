'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from './ui/sidebar';
import {
  User,
  PanelLeft,
  Bell,
  Star,
  CheckCheck,
  MessageSquareText,
  LogOut,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { signOut, useSession } from 'next-auth/react';

export function DashboardHeader() {
  const { isMobile } = useSidebar();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const { data: session } = useSession();

  const user = {
    name: session?.user?.name || 'User',
    email: session?.user?.email || 'user@example.com',
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {isMobile && <SidebarTrigger />}

      <div className="flex-1 text-xl font-headline font-semibold tracking-tight">
        {/* Page title could be dynamic here */}
      </div>
      <TooltipProvider>
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-tour="notifications">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-primary"></span>
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
            <DropdownMenuItem className="flex items-start gap-3">
              <MessageSquareText className="text-blue-500 mt-1" />
              <div className="grid gap-0.5">
                <p className="font-medium">New Survey Response</p>
                <p className="text-xs text-muted-foreground">
                  You have a new response for the &quot;Q2 Product Satisfaction&quot;
                  survey.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-start gap-3">
              <Star className="text-yellow-500 mt-1" />
              <div className="grid gap-0.5">
                <p className="font-medium">New Reward Earned</p>
                <p className="text-xs text-muted-foreground">
                  You received 150 points for your feedback on Aura Smartwatch.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-start gap-3">
              <CheckCheck className="text-green-500 mt-1" />
              <div className="grid gap-0.5">
                <p className="font-medium">Payout Processed</p>
                <p className="text-xs text-muted-foreground">
                  Your request for $10.00 has been approved and is on its way.
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground"
                  data-tour="user-menu"
                >
                  <Avatar className="h-9 w-9">
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
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setUserMenuOpen(false);
                if (typeof window !== 'undefined' && (window as any).__startProductTour) {
                  (window as any).__startProductTour();
                }
              }}
              className="cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
              Restart Product Tour
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    </header>
  );
}
