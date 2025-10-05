"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Star, MessageSquareText, Target, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressEntry {
  id: string;
  topic_name: string; // Joined from progress_topics
  rating: number;
  comment?: string;
  targets?: string;
  entry_date: string; // ISO string
}

interface ProgressEntryCardProps {
  entry: ProgressEntry;
  onEdit: (entryId: string) => void; // New prop for edit functionality
}

const ProgressEntryCard: React.FC<ProgressEntryCardProps> = ({ entry, onEdit }) => {
  const hasContent = (text: string | null | undefined) => text != null && text.trim().length > 0;

  return (
    <Card className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onEdit(entry.id)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{entry.topic_name}</CardTitle>
        <CardDescription className="flex items-center text-muted-foreground text-sm">
          <CalendarDays className="mr-2 h-4 w-4" />
          <span>{format(new Date(entry.entry_date), "PPP")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < entry.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted-foreground"
              )}
            />
          ))}
          <span className="ml-2 text-muted-foreground">{entry.rating} / 5 Stars</span>
        </div>
        {hasContent(entry.comment) && (
          <div>
            <h3 className="font-semibold mb-1 flex items-center">
              <MessageSquareText className="mr-2 h-4 w-4 text-muted-foreground" />
              Comment:
            </h3>
            <p className="text-muted-foreground">{entry.comment}</p>
          </div>
        )}
        {hasContent(entry.targets) && (
          <div>
            <h3 className="font-semibold mb-1 flex items-center">
              <Target className="mr-2 h-4 w-4 text-muted-foreground" />
              Targets:
            </h3>
            <p className="text-muted-foreground">{entry.targets}</p>
          </div>
        )}
        {!hasContent(entry.comment) && !hasContent(entry.targets) && (
          <p className="text-muted-foreground italic">No detailed notes or targets for this entry.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressEntryCard;