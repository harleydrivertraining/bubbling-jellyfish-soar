"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Save, MessageSquare, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import StarRatingInput from "@/components/StarRatingInput";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Topic {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProgressEntry {
  topic_id: string;
  rating: number;
  comment: string | null;
}

interface Student {
  id: string;
  name: string;
}

const StudentProgressDetail: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const [student, setStudent] = useState<Student | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [entries, setEntries] = useState<Record<string, ProgressEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);

    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      const { data: topicsData, error: topicsError } = await supabase
        .from("progress_topics")
        .select("id, name, is_default")
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (topicsError) throw topicsError;

      const { data: hiddenData } = await supabase
        .from("hidden_progress_topics")
        .select("topic_id")
        .eq("user_id", user.id);
      
      const hiddenIds = new Set((hiddenData || []).map(h => h.topic_id));
      const visibleTopics = (topicsData || []).filter(t => !hiddenIds.has(t.id));
      setTopics(visibleTopics);

      const { data: entriesData, error: entriesError } = await supabase
        .from("student_progress_entries")
        .select("topic_id, rating, comment, entry_date")
        .eq("student_id", studentId)
        .order("entry_date", { ascending: false });

      if (entriesError) throw entriesError;

      const latestEntries: Record<string, ProgressEntry> = {};
      entriesData?.forEach(entry => {
        if (!latestEntries[entry.topic_id]) {
          latestEntries[entry.topic_id] = {
            topic_id: entry.topic_id,
            rating: entry.rating,
            comment: entry.comment,
          };
        }
      });
      setEntries(latestEntries);

    } catch (error: any) {
      console.error("Error fetching progress detail:", error);
      showError("Failed to load progress data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, studentId]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const saveEntry = async (topicId: string, ratingOverride?: number, commentOverride?: string) => {
    if (!user || !studentId) return;
    
    const currentEntry = entries[topicId] || { topic_id: topicId, rating: 0, comment: "" };
    const rating = ratingOverride !== undefined ? ratingOverride : currentEntry.rating;
    const comment = commentOverride !== undefined ? commentOverride : currentEntry.comment;

    if (rating === 0) {
      showError("Please select a star rating.");
      return;
    }

    setSavingTopicId(topicId);
    const { error } = await supabase
      .from("student_progress_entries")
      .insert({
        user_id: user.id,
        student_id: studentId,
        topic_id: topicId,
        rating: rating,
        comment: comment,
        entry_date: new Date().toISOString()
      });

    if (error) {
      showError("Failed to save progress: " + error.message);
    } else {
      setEntries(prev => ({
        ...prev,
        [topicId]: { topic_id: topicId, rating, comment }
      }));
      
      if (ratingOverride !== undefined) {
        showSuccess("Rating saved!");
      } else {
        showSuccess("Notes saved!");
        setExpandedTopicId(null);
      }
    }
    setSavingTopicId(null);
  };

  const handleRatingChange = (topicId: string, newRating: number) => {
    saveEntry(topicId, newRating);
  };

  const handleCommentChange = (topicId: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || { topic_id: topicId, rating: 0, comment: "" }),
        comment: value
      }
    }));
  };

  const toggleExpand = (topicId: string) => {
    setExpandedTopicId(expandedTopicId === topicId ? null : topicId);
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/progress"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Students</Link>
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{student?.name}</h1>
          <p className="text-muted-foreground font-medium">Individual Progress Tracking</p>
        </div>
      </div>

      {topics.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No progress topics available.</p>
          <Button asChild variant="outline"><Link to="/manage-topics">Manage Topics</Link></Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {topics.map((topic) => {
            const entry = entries[topic.id] || { rating: 0, comment: "" };
            const isSaving = savingTopicId === topic.id;
            const isExpanded = expandedTopicId === topic.id;

            return (
              <Card key={topic.id} className={cn(
                "overflow-hidden transition-all duration-200 border-l-4 flex flex-col",
                entry.rating > 0 ? "border-l-green-500" : "border-l-muted",
                isExpanded && "col-span-2"
              )}>
                <div className={cn(
                  "p-3 sm:p-4 flex flex-col h-full",
                  isExpanded && "sm:flex-row sm:items-center sm:justify-between"
                )}>
                  <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm sm:text-lg font-bold truncate">{topic.name}</h3>
                      {topic.is_default && <Badge variant="secondary" className="text-[8px] sm:text-[10px] h-3 sm:h-4 px-1">DEFAULT</Badge>}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <StarRatingInput 
                        value={entry.rating} 
                        onChange={(val) => handleRatingChange(topic.id, val)} 
                        disabled={isSaving}
                      />
                      {isSaving && savingTopicId === topic.id && (
                        <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground animate-pulse uppercase">Saving...</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 mt-auto sm:mt-0">
                    {entry.comment && !isExpanded && (
                      <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground text-[10px] px-1.5 py-0">
                        <MessageSquare className="h-3 w-3" />
                      </Badge>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => toggleExpand(topic.id)}
                      className="h-8 w-8 rounded-full"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                        <MessageSquare className="mr-1 h-3 w-3" /> Instructor Notes
                      </Label>
                      <Textarea 
                        placeholder="Add specific feedback or targets for this topic..." 
                        value={entry.comment || ""} 
                        onChange={(e) => handleCommentChange(topic.id, e.target.value)} 
                        className="min-h-[100px] bg-muted/30" 
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={() => saveEntry(topic.id)} 
                          disabled={isSaving} 
                          size="sm"
                          className="font-bold"
                        >
                          {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Notes</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentProgressDetail;