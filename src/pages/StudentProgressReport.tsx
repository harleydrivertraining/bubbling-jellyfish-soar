"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  TrendingUp, 
  Star, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  Award,
  UserCircle,
  ShieldCheck,
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StarRatingInput from "@/components/StarRatingInput";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Topic {
  id: string;
  name: string;
}

interface ProgressEntry {
  topic_id: string;
  rating: number;
  comment: string | null;
}

const StudentProgressReport: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "self" ? "self" : "instructor";
  
  const [student, setStudent] = useState<any>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [instructorEntries, setInstructorEntries] = useState<Record<string, ProgressEntry>>({});
  const [selfEntries, setSelfEntries] = useState<Record<string, ProgressEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      const [topicsRes, hiddenRes] = await Promise.all([
        supabase.from("progress_topics").select("id, name, is_default").or(`user_id.eq.${studentData.user_id},is_default.eq.true`),
        supabase.from("hidden_progress_topics").select("topic_id").eq("user_id", studentData.user_id)
      ]);

      const hiddenIds = new Set((hiddenRes.data || []).map(h => h.topic_id));
      const visibleTopics = (topicsRes.data || []).filter(t => !hiddenIds.has(t.id));
      setTopics(visibleTopics);

      const { data: entriesData } = await supabase
        .from("student_progress_entries")
        .select("topic_id, rating, comment, user_id")
        .eq("student_id", studentData.id)
        .order("entry_date", { ascending: false });

      const instEntries: Record<string, ProgressEntry> = {};
      const sEntries: Record<string, ProgressEntry> = {};

      entriesData?.forEach(entry => {
        if (entry.user_id === user.id) {
          if (!sEntries[entry.topic_id]) {
            sEntries[entry.topic_id] = {
              topic_id: entry.topic_id,
              rating: entry.rating,
              comment: entry.comment,
            };
          }
        } else {
          if (!instEntries[entry.topic_id]) {
            instEntries[entry.topic_id] = {
              topic_id: entry.topic_id,
              rating: entry.rating,
              comment: entry.comment,
            };
          }
        }
      });
      
      setInstructorEntries(instEntries);
      setSelfEntries(sEntries);

    } catch (error: any) {
      console.error("Error fetching progress report:", error);
      showError("Failed to load your progress report.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const saveSelfEntry = async (topicId: string, ratingOverride?: number) => {
    if (!user || !student) return;
    
    const currentEntry = selfEntries[topicId] || { topic_id: topicId, rating: 0, comment: "" };
    const rating = ratingOverride !== undefined ? ratingOverride : currentEntry.rating;
    const comment = currentEntry.comment;

    if (rating === 0) {
      showError("Please select a star rating.");
      return;
    }

    setSavingTopicId(topicId);
    const { error } = await supabase
      .from("student_progress_entries")
      .insert({
        user_id: user.id,
        student_id: student.id,
        topic_id: topicId,
        rating: rating,
        comment: comment,
        entry_date: new Date().toISOString()
      });

    if (error) {
      showError("Failed to save your assessment: " + error.message);
    } else {
      setSelfEntries(prev => ({
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

  const handleSelfCommentChange = (topicId: string, value: string) => {
    setSelfEntries(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || { topic_id: topicId, rating: 0, comment: "" }),
        comment: value
      }
    }));
  };

  const completionStats = useMemo(() => {
    if (topics.length === 0) return { percentage: 0, total: 0, completed: 0 };
    
    const totalPossibleStars = topics.length * 5;
    const totalEarnedStars = topics.reduce((sum, topic) => {
      const entry = instructorEntries[topic.id];
      return sum + (entry ? entry.rating : 0);
    }, 0);
    
    const percentage = Math.round((totalEarnedStars / totalPossibleStars) * 100);
    const fullyCompletedCount = topics.filter(t => instructorEntries[t.id]?.rating === 5).length;

    return {
      percentage,
      total: topics.length,
      completed: fullyCompletedCount
    };
  }, [topics, instructorEntries]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 bg-card p-6 rounded-2xl border shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Progress Report</h1>
              <p className="text-muted-foreground font-medium">Detailed breakdown of your driving skills.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold">
              {student?.status} Level
            </Badge>
            <Badge variant="secondary" className="font-bold">
              {completionStats.completed} / {completionStats.total} Skills Mastered
            </Badge>
          </div>
        </div>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" /> Overall Completion
              </p>
              <span className="text-4xl font-black text-green-600">{completionStats.percentage}%</span>
            </div>
            <Progress value={completionStats.percentage} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="instructor" className="font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Instructor's Report
          </TabsTrigger>
          <TabsTrigger value="self" className="font-bold flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> Self Assessment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instructor" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topics.map((topic) => {
              const entry = instructorEntries[topic.id] || { rating: 0, comment: "" };
              const isExpanded = expandedTopicId === topic.id;

              return (
                <Card key={topic.id} className={cn(
                  "overflow-hidden transition-all duration-200 border-l-4 flex flex-col",
                  entry.rating === 5 ? "border-l-green-500 bg-green-50/10" : 
                  entry.rating > 0 ? "border-l-blue-500" : "border-l-muted",
                  isExpanded && "sm:col-span-2"
                )}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate flex items-center gap-2">
                        {topic.name}
                        {entry.rating === 5 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn(
                              "h-4 w-4", 
                              i < entry.rating ? "fill-yellow-400 text-yellow-400" : "text-muted/30"
                            )} 
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.comment && (
                        <Badge variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center rounded-full bg-muted/50">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                        className="h-8 w-8 rounded-full"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Instructor Feedback</p>
                        <div className="bg-muted/30 p-4 rounded-xl italic text-sm text-foreground border border-muted">
                          {entry.comment || "No specific feedback recorded for this skill yet."}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="self" className="mt-6">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
            <p className="text-sm text-blue-800 font-medium">
              How do you feel about your driving? Use this section to rate yourself and add notes for your next lesson. Your instructor can see these too!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topics.map((topic) => {
              const entry = selfEntries[topic.id] || { rating: 0, comment: "" };
              const isSaving = savingTopicId === topic.id;
              const isExpanded = expandedTopicId === `self-${topic.id}`;

              return (
                <Card key={topic.id} className={cn(
                  "overflow-hidden transition-all duration-200 border-l-4 flex flex-col",
                  entry.rating > 0 ? "border-l-primary bg-primary/5" : "border-l-muted",
                  isExpanded && "sm:col-span-2"
                )}>
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate mb-2">{topic.name}</h3>
                      <div className="flex items-center gap-4">
                        <StarRatingInput 
                          value={entry.rating} 
                          onChange={(val) => saveSelfEntry(topic.id, val)} 
                          disabled={isSaving}
                        />
                        {isSaving && savingTopicId === topic.id && (
                          <span className="text-[10px] font-bold text-muted-foreground animate-pulse uppercase">Saving...</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      {entry.comment && !isExpanded && (
                        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground text-[10px] px-1.5 py-0">
                          <MessageSquare className="h-3 w-3" />
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setExpandedTopicId(isExpanded ? null : `self-${topic.id}`)}
                        className="h-8 w-8 rounded-full"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-3 pt-3 border-t">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                          <MessageSquare className="mr-1 h-3 w-3" /> Your Thoughts / Questions
                        </Label>
                        <Textarea 
                          placeholder="How do you feel about this topic? Any questions for your instructor?" 
                          value={entry.comment || ""} 
                          onChange={(e) => handleSelfCommentChange(topic.id, e.target.value)} 
                          className="min-h-[100px] bg-background" 
                        />
                        <div className="flex justify-end">
                          <Button 
                            onClick={() => saveSelfEntry(topic.id)} 
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProgressReport;