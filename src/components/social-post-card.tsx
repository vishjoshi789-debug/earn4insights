
'use client';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { SocialPost } from '@/lib/data';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  Repeat,
  Heart,
  Twitter,
  Instagram,
  Clapperboard,
  Crown,
  Info,
  Facebook,
  Star,
} from 'lucide-react';
import Image from 'next/image';

const platformIcons: { [key: string]: React.ReactNode } = {
  twitter: <Twitter className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  tiktok: <Clapperboard className="h-4 w-4" />,
  meta: <Facebook className="h-4 w-4" />,
  google: <Star className="h-4 w-4" />,
};

const formatCount = (count: number) => {
  if (count > 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count > 1000) return `${(count / 1000).toFixed(1)}K`;
  return count;
};

export function SocialPostCard({ post }: { post: SocialPost }) {
  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.timestamp), {
    addSuffix: true,
  });

  return (
    <Card className="bg-background flex flex-col">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Avatar>
          <AvatarImage src={post.userAvatar} />
          <AvatarFallback>
            {post.userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{post.userName}</p>
              <p className="text-xs text-muted-foreground">{post.userHandle}</p>
            </div>
            <div className="text-muted-foreground">
              {platformIcons[post.platform]}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <p className="text-sm text-foreground/90">{post.text}</p>
        {post.mediaUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image
              src={post.mediaUrl}
              alt={`Social media post by ${post.userName}`}
              fill
              className="object-cover"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4 text-xs">
        <div className="flex w-full justify-between text-muted-foreground">
            <div className='flex items-center gap-4'>
                <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" /> {formatCount(post.likes)}
                </span>
                <span className="flex items-center gap-1">
                    <Repeat className="h-4 w-4" /> {formatCount(post.shares)}
                </span>
                <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" /> {formatCount(post.comments)}
                </span>
            </div>
             <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
         <div className="flex flex-wrap items-center gap-2 text-xs w-full">
            <Badge
                variant="outline"
                className={cn('border', getSentimentBadge(post.analysis.sentiment))}
            >
                {post.analysis.sentiment.charAt(0).toUpperCase() +
                post.analysis.sentiment.slice(1)}{' '}
                ({(post.analysis.sentimentScore * 100).toFixed(0)}%)
            </Badge>
            <Badge variant="outline">{post.analysis.category}</Badge>
            {post.analysis.isKeyOpinionLeader && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="outline" className="border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300">
                                <Crown className="mr-1 h-3 w-3" />
                                KOL
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                        <p>Key Opinion Leader</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
         </div>
      </CardFooter>
    </Card>
  );
}
