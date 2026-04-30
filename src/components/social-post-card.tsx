'use client';

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Heart,
  Repeat2,
  Twitter,
  Instagram,
  Facebook,
  ShoppingBag,
  Store,
  Globe2,
  Star,
  Eye,
  Youtube,
  Linkedin,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Accepts the DB SocialPost shape (or a compatible subset)
export type SocialPostCardData = {
  id: string;
  platform: string;
  postType?: string | null;
  content: string;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  authorHandle?: string | null;
  authorAvatar?: string | null;
  likes: number;
  shares: number;
  comments: number;
  views?: number | null;
  rating?: number | null;
  sentiment?: string | null;
  sentimentScore?: number | null;
  engagementScore?: number | null;
  influenceScore?: number | null;
  isKeyOpinionLeader?: boolean;
  category?: string | null;
  postedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type SocialPostCardProps = {
  post: SocialPostCardData;
  productName?: string;
};

function getPlatformMeta(platform: string) {
  switch (platform) {
    case 'twitter':
      return { label: 'Twitter / X', Icon: Twitter };
    case 'instagram':
      return { label: 'Instagram', Icon: Instagram };
    case 'tiktok':
      return { label: 'TikTok', Icon: MessageSquare };
    case 'meta':
      return { label: 'Meta', Icon: Facebook };
    case 'google':
      return { label: 'Google Reviews', Icon: Star };
    case 'amazon':
      return { label: 'Amazon Reviews', Icon: ShoppingBag };
    case 'flipkart':
      return { label: 'Flipkart Reviews', Icon: Store };
    case 'reddit':
      return { label: 'Reddit', Icon: Globe2 };
    case 'youtube':
      return { label: 'YouTube', Icon: Youtube };
    case 'linkedin':
      return { label: 'LinkedIn', Icon: Linkedin };
    default:
      return { label: platform, Icon: MessageSquare };
  }
}

function sentimentColor(sentiment: string | null | undefined) {
  if (sentiment === 'positive') return 'text-emerald-600';
  if (sentiment === 'negative') return 'text-red-600';
  return 'text-muted-foreground';
}

function ratingStars(rating: number) {
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
}

export function SocialPostCard({ post, productName }: SocialPostCardProps) {
  const { label, Icon } = getPlatformMeta(post.platform);
  const displayDate = post.postedAt || post.createdAt;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <Avatar className="h-9 w-9 shrink-0">
          {post.authorAvatar && <AvatarImage src={post.authorAvatar} />}
          <AvatarFallback>
            {(post.author || '?').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="font-semibold leading-tight truncate">{post.author || 'Anonymous'}</p>
            {post.authorHandle && (
              <p className="text-xs text-muted-foreground truncate">{post.authorHandle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="flex items-center gap-1 max-w-full">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="text-[11px] truncate">{label}</span>
            </Badge>
            {post.category && (
              <Badge variant="secondary" className="text-[10px] capitalize max-w-full">
                <span className="truncate">{post.category.replace(/_/g, ' ')}</span>
              </Badge>
            )}
            {displayDate && (
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(displayDate), { addSuffix: true })}
              </p>
            )}
          </div>
          {productName && (
            <p className="text-xs text-muted-foreground truncate">
              About: <span className="font-medium">{productName}</span>
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pt-0 px-4 pb-4 sm:px-6 sm:pb-6 min-w-0">
        {post.title && (
          <p className="text-sm font-medium break-words">{post.title}</p>
        )}
        <p className="text-sm text-foreground/90 whitespace-pre-line break-words">
          {post.content}
        </p>

        {post.rating != null && post.rating > 0 && (
          <p className="text-sm text-amber-500 font-medium">
            {ratingStars(post.rating)} <span className="text-xs text-muted-foreground ml-1">{post.rating.toFixed(1)}</span>
          </p>
        )}

        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-block"
          >
            View original →
          </a>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.likes.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="h-3 w-3" />
            {post.shares.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.comments.toLocaleString()}
          </span>
          {post.views != null && post.views > 0 && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views.toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-2 border-t bg-muted/30 py-2 px-4 sm:px-6 text-[11px]">
        {post.sentiment && (
          <span>
            Sentiment:{' '}
            <span className={`font-medium capitalize ${sentimentColor(post.sentiment)}`}>
              {post.sentiment}
            </span>
            {post.sentimentScore != null && (
              <span className="ml-1">({(Math.abs(post.sentimentScore) * 100).toFixed(0)}%)</span>
            )}
          </span>
        )}
        {post.influenceScore != null && post.influenceScore > 0 && (
          <span>
            Influence: <span className="font-medium">{(post.influenceScore * 100).toFixed(0)}/100</span>
          </span>
        )}
        {post.isKeyOpinionLeader && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Star className="h-3 w-3" />
            Key opinion leader
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
