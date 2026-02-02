'use client';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarRating } from '@/components/star-rating';
import { Badge } from '@/components/ui/badge';
import type { Feedback } from '@/lib/data';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { CircleAlert, ShieldCheck, ShieldAlert } from 'lucide-react';

export function FeedbackAnalysis({ feedback }: { feedback: Feedback }) {
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

  const timeAgo = formatDistanceToNow(new Date(feedback.timestamp), {
    addSuffix: true,
  });

  return (
    <Card className="bg-background">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Avatar>
          <AvatarImage src={feedback.userAvatar} />
          <AvatarFallback>
            {feedback.userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{feedback.userName}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          <StarRating rating={feedback.rating} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/90">{feedback.text}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <Badge
          variant="outline"
          className={cn('border', getSentimentBadge(feedback.analysis.sentiment))}
        >
          {feedback.analysis.sentiment.charAt(0).toUpperCase() +
            feedback.analysis.sentiment.slice(1)}{' '}
          ({(feedback.analysis.sentimentScore * 100).toFixed(0)}%)
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {feedback.analysis.isPotentiallyFake ? (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                )}
                <span className="text-muted-foreground">Authenticity:</span>
                <span
                  className={cn(
                    'font-medium',
                    feedback.analysis.isPotentiallyFake
                      ? 'text-destructive'
                      : 'text-foreground'
                  )}
                >
                  {(feedback.analysis.authenticityScore * 100).toFixed(0)}%
                </span>
                <CircleAlert className="h-3 w-3 text-muted-foreground/50" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{feedback.analysis.reason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
