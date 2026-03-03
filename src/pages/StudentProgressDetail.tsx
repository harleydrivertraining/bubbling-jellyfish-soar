"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Save, MessageSquare, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import StarRatingInput from "@/components/StarRatingInput";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  name: string;
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

  const fetchData = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);

    try {
      // 1. Fetch Student
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // 2. Fetch All Topics
      const { data: topicsData, error: topicsError } = await supabase
        .from("progress_topics")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (topicsError) throw topicsError;
      setTopics(topicsData || []);

      // 3. Fetch Latest Entries for each topic
      // We'll fetch all entries for this student and then pick the latest for each topic
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

  const handleUpdateEntry = (topicId: string, field: 'rating' | 'comment', value: any) => {
    setEntries(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || { topic_id: topicId, rating: 0, comment: "" }),
        [field]: value
      }
    }));
  };

  const saveEntry = async (topicId: string) => {
    if (!user || !studentId) return;
    const entry = entries[topicId];
    if (!entry || entry.rating === 0) {
      showError("Please select a star rating before saving.");
      return;
    }

    setSavingTopicId(topicId);
    const { error } = await supabase
      .from("student_progress_entries")
      .insert({
        user_id: user.id,
        student_id: studentId,
        topic_id: topicId,
        rating: entry.rating,
        comment: entry.comment,
        entry_date: new Date().toISOString()
      });

    if (error) {
      showError("Failed to save progress: " + error.message);
    } else {
      showSuccess("Progress updated!");
    }
    setSavingTopicId(null);
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/progress">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
          </Link>
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
          <p className="text-muted-foreground mb-4">You haven't added any progress topics yet.</p>
          <Button asChild variant="outline">
            <Link to="/manage-topics">Manage Topics</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {topics.map((topic) => {
            const entry = entries[topic.id] || { rating: 0, comment: "" };
            const isSaving = savingTopicId === topic.id;

            return (
              <Card key={topic.id} className="overflow-hidden border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold">{topic.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Proficiency Level</Label>
                      <StarRatingInput 
                        value={entry.rating} 
                        onChange={(val) => handleUpdateEntry(topic.id, 'rating', val)} 
                      />
                    </div>
                    <Button 
                      onClick={() => saveEntry(topic.id)} 
                      disabled={isSaving}
                      className="sm:w-32 font-bold"
                    >
                      {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save</>}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                      <MessageSquare className="mr-1 h-3 w-3" /> Comments / Next Steps
                    </Label>
                    <Textarea 
                      placeholder="Add notes about their performance or what to focus on next..."
                      value={entry.comment || ""}
                      onChange={(e) => handleUpdateEntry(topic.id, 'comment', e.target.value)}
                      className="min-h-[80px] bg-muted/30"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentProgressDetail;