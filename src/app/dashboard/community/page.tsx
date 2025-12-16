'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { mockSocialPosts } from '@/lib/data';

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community</h1>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockSocialPosts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {post.platform.toUpperCase()} · @{post.userHandle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{post.text}</p>
              <div className="text-xs text-muted-foreground flex gap-4">
                <span>👍 {post.likes}</span>
                <span>💬 {post.comments}</span>
                <span>🔁 {post.shares}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
