import { Badge } from '@/components/ui/badge';
import { MessageSquare, Paperclip } from 'lucide-react';

interface TaskNotificationBadgeProps {
  newComments: number;
  newAttachments: number;
  className?: string;
}

export function TaskNotificationBadge({ 
  newComments, 
  newAttachments, 
  className = "" 
}: TaskNotificationBadgeProps) {
  if (newComments === 0 && newAttachments === 0) {
    return null;
  }

  return (
    <div className={`flex gap-1 ${className}`}>
      {newComments > 0 && (
        <Badge variant="destructive" className="text-xs px-1.5 py-0.5 flex items-center gap-1 animate-pulse shadow-sm">
          <MessageSquare className="h-3 w-3" />
          {newComments}
        </Badge>
      )}
      {newAttachments > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex items-center gap-1 animate-pulse shadow-sm">
          <Paperclip className="h-3 w-3" />
          {newAttachments}
        </Badge>
      )}
    </div>
  );
}
