'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { mockProducts, mockSocialPosts, type SocialPost } from '@/lib/data';
import { SocialPostCard } from '@/components/social-post-card';

type PlatformFilter = 'all' | SocialPost['platform'];

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'All platforms' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google Reviews' },
  { value: 'amazon', label: 'Amazon Reviews' },
  { value: 'flipkart', label: 'Flipkart Reviews' },
  { value: 'reddit', label: 'Reddit' },
];

function getProductName(productId: string): string {
  return mockProducts.find((p) => p.id === productId)?.name ?? 'Unknown product';
}

export default function SocialPage() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const filteredPosts = useMemo(() => {
    if (platformFilter === 'all') {
      return mockSocialPosts;
    }
    return mockSocialPosts.filter((post) => post.platform === platformFilter);
  }, [platformFilter]);

  const sortedPosts = useMemo(
    () =>
      [...filteredPosts].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [filteredPosts],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-headline">
              Social listening
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor what customers are saying across platforms in one view.
            </p>
          </div>

          <div className="w-full md:w-64">
            <Select
              value={platformFilter}
              onValueChange={(value) =>
                setPlatformFilter(value as PlatformFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {sortedPosts.length === 0 && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No posts for this platform yet. Try selecting &quot;All
              platforms&quot; or another source.
            </p>
          </CardContent>
        )}
      </Card>

      {sortedPosts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedPosts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              productName={getProductName(post.productId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
