"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { 
  UserCircle, 
  MessageSquare, 
  Star, 
  Search, 
  Filter,
  Calendar,
  ArrowRight,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelfAssessment {
  id: string;
  student_id: string;
  topic_id: string;
  rating: number;
  comment: string | null;
  entry_date: string;
  user_id: string; // Creator ID
  students: {
    name: string;
  };
  progress_topics: {
    name: string;
  };
}

const StudentSelfAssessments: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [assessments, setAssessments] = useState<SelfAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Get all students belonging to this instructor
      const { data: myStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id);

      if (studentsError) throw studentsError;
      
      if (!myStudents || myStudents.length === 0) {
        setAssessments([]);
        setIsLoading(false);
        return;
      }

      const studentIds = myStudents.map(s => s.id);

      // 2. Fetch all progress entries for these students
      // We filter for entries where user_id (creator) is NOT the instructor's ID
      const { data: entries, error: entriesError } = await supabase
        .from("student_progress_entries")
        .select(`
          id,
          student_id,
          topic_id,
          rating,
          comment,
          entry_date,
          user_id,
          students(name),
          progress_topics(name)
        `)
        .in("student_id", studentIds)
        .neq("user_id", user.id) // Exclude entries made by the instructor
        .order("entry_date", { ascending: false });

      if (entriesError) throw entriesError;
      
      setAssessments(entries as any || []);
    } catch (error: any) {
      console.error("Error fetching self-assessments:", error);
      showError("Failed to load pupil self-assessments. Please ensure your students have recorded their own ratings.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchAssessments();
  }, [isSessionLoading, fetchAssessments]);

  const uniqueStudents = useMemo(() => {
    const map = new Map();
    assessments.forEach(a => {
      if (!map.has(a.student_id)) {
        map.set(a.student_id, a.students?.name || "Unknown Student");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      const studentName = a.students?.name || "";
      const topicName = a.progress_topics?.name || "";
      const comment = a.comment || "";

      const matchesSearch = 
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        topicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStudent = selectedStudentId === "all" || a.student_id === selectedStudentId;
      
      return matchesSearch && matchesStudent;
    });
  }, [assessments, searchTerm, selectedStudentId]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Pupil Self-Assessments</h1>
          <p className="text-muted-foreground font-medium">See how your students rate their own progress.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-muted/30 p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by student, topic or comment..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filter by Student" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {uniqueStudents.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredAssessments.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {assessments.length === 0 
              ? "No pupil self-assessments found yet. Encourage your students to use the 'Self Assessment' tab in their progress report!" 
              : "No self-assessments found matching your filters."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssessments.map((assessment) => (
            <Card key={assessment.id} className="flex flex-col hover:shadow-md transition-all border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-bold truncate flex items-center gap-2">
                      <User className="h-4 w-4 text-primary/60" />
                      {assessment.students?.name || "Unknown Student"}
                    </CardTitle>
                    <CardDescription className="font-bold text-primary mt-0.5">
                      {assessment.progress_topics?.name || "Unknown Topic"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 text-[10px] font-bold uppercase">
                    Self-Rated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={cn(
                        "h-4 w-4", 
                        i < assessment.rating ? "fill-yellow-400 text-yellow-400" : "text-muted/30"
                      )} 
                    />
                  ))}
                  <span className="text-xs font-bold text-muted-foreground ml-2">
                    {assessment.rating}/5
                  </span>
                </div>

                {assessment.comment && (
                  <div className="bg-muted/30 p-3 rounded-lg border border-muted italic text-sm relative">
                    <MessageSquare className="h-3 w-3 text-muted-foreground absolute -top-1.5 -left-1.5 bg-background rounded-full" />
                    "{assessment.comment}"
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 mt-auto border-t">
                  <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase">
                    <Calendar className="mr-1 h-3 w-3" />
                    {format(parseISO(assessment.entry_date), "MMM d, yyyy")}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase" asChild>
                    <Link to={`/students/${assessment.student_id}`}>
                      View Profile <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentSelfAssessments;