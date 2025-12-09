'use client';

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Heart,
  Repeat2,
  Share2,
  Twitter,
  Instagram,
  Facebook,
  ShoppingBag,
  Store,
  Globe2,
  Star,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SocialPost } from '@/lib/data';

type SocialPostCardProps = {
  post: SocialPost;
  productName?: string;
};

function getPlatformMeta(platform: SocialPost['platform']) {
  switch (platform) {
    case 'twitter':
      return { label: 'Twitter', Icon: Twitter };
    case 'instagram':
      return { label: 'Instagram', Icon: Instagram };
    case 'tiktok':
      // Lucide doesn’t have a TikTok logo – use a generic chat bubble
      return { label: 'TikTok', Icon: MessageSquare };
    case 'meta':
      // Treat as Facebook / Meta
      return { label: 'Meta', Icon: Facebook };
    case 'google':
      return { label: 'Google Reviews', Icon: Star };
    case 'amazon':
      return { label: 'Amazon Reviews', Icon: ShoppingBag };
    case 'flipkart':
      return { label: 'Flipkart Reviews', Icon: Store };
    case 'reddit':
      // No Reddit icon in lucide-react – use a globe as “forums”
      return { label: 'Reddit', Icon: Globe2 };
    default:
      return { label: platform, Icon: MessageSquare };
  }
}

export function SocialPostCard({ post, productName }: SocialPostCardProps) {
  const { label, Icon } = getPlatformMeta(post.platform);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <Avatar>
          <AvatarImage src={post.userAvatar} />
          <AvatarFallback>
            {post.userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{post.userName}</p>
              <p className="text-xs text-muted-foreground">{post.userHandle}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                <span className="text-[11px]">{label}</span>
              </Badge>
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(post.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
          {productName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Talking about: <span className="font-medium">{productName}</span>
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        <p className="text-sm text-foreground/90 whitespace-pre-line">
          {post.text}
        </p>

        {post.mediaUrl && (
          <div className="mt-2 overflow-hidden rounded-md border bg-muted/40">
            {/* You can replace this with actual media rendering later */}
            <div className="p-3 text-xs text-muted-foreground">
              Attached media: {post.mediaUrl}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.likes.toLocaleString()} likes
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="h-3 w-3" />
            {post.shares.toLocaleString()} shares
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.comments.toLocaleString()} comments
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-2 border-t bg-muted/30 py-2 text-[11px]">
        <span>
          Sentiment:{' '}
          <span className="font-medium capitalize">{post.analysis.sentiment}</span>{' '}
          ({(post.analysis.sentimentScore * 100).toFixed(0)}%)
        </span>
        <span>
          Influence score:{' '}
          <span className="font-medium">
            {(post.analysis.influenceScore * 100).toFixed(0)}/100
          </span>
        </span>
        {post.analysis.isKeyOpinionLeader && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Star className="h-3 w-3" />
            Key opinion leader
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
