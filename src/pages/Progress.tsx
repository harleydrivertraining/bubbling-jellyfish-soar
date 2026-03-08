"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Progress as ProgressBar } from "@/components/ui/progress";

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
  is_past_student: boolean;
}

interface ProgressData {
  studentId: string;
  percentage: number;
}

const Progress: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProgressStats = useCallback(async (studentIds: string[]) => {
    if (!user || studentIds.length === 0) return;

    try {
      // 1. Fetch visible topics count
      const [topicsRes, hiddenRes] = await Promise.all([
        supabase.from("progress_topics").select("id").or(`user_id.eq.${user.id},is_default.eq.true`),
        supabase.from("hidden_progress_topics").select("topic_id").eq("user_id", user.id)
      ]);

      const hiddenIds = new Set((hiddenRes.data || []).map(h => h.topic_id));
      const visibleTopicsCount = (topicsRes.data || []).filter(t => !hiddenIds.has(t.id)).length;

      if (visibleTopicsCount === 0) return;

      // 2. Fetch latest entries for these students
      const { data: entries, error } = await supabase
        .from("student_progress_entries")
        .select("student_id, topic_id, rating, entry_date")
        .in("student_id", studentIds)
        .order("entry_date", { ascending: false });

      if (error) throw error;

      // 3. Calculate percentage per student (latest rating per topic)
      const stats: Record<string, number> = {};
      const maxPossibleStars = visibleTopicsCount * 5;

      studentIds.forEach(sId => {
        const studentEntries = entries?.filter(e => e.student_id === sId) || [];
        const latestRatings: Record<string, number> = {};
        
        studentEntries.forEach(entry => {
          if (!latestRatings[entry.topic_id]) {
            latestRatings[entry.topic_id] = entry.rating;
          }
        });

        const totalStars = Object.values(latestRatings).reduce((sum, r) => sum + r, 0);
        stats[sId] = Math.round((totalStars / maxPossibleStars) * 100);
      });

      setProgressData(stats);
    } catch (error: any) {
      console.error("Error fetching progress stats:", error);
    }
  }, [user]);

  const fetchStudents = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, status, is_past_student")
      .eq("user_id", user.id)
      .eq("is_past_student", false)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching students for progress:", error);
      showError("Failed to load students: " + error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
      if (data && data.length > 0) {
        fetchProgressStats(data.map(s => s.id));
      }
    }
    setIsLoading(false);
  }, [user, fetchProgressStats]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [isSessionLoading, fetchStudents]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return students.filter((student) =>
      student.name.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [students, searchTerm]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Progress Tracking</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {students.length === 0 
              ? "No active students found. Add students to start tracking their progress." 
              : "No students match your search."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((student) => {
            const percentage = progressData[student.id] || 0;
            
            return (
              <Card key={student.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-bold flex items-center">
                      <User className="mr-2 h-5 w-5 text-primary/60" />
                      {student.name}
                    </CardTitle>
                    <Badge variant={
                      student.status === "Beginner" ? "secondary" :
                      student.status === "Intermediate" ? "default" :
                      "outline"
                    }>
                      {student.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 mt-auto space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                      <span>Course Completion</span>
                      <span className="text-primary">{percentage}%</span>
                    </div>
                    <ProgressBar value={percentage} className="h-1.5" />
                  </div>
                  
                  <Button asChild className="w-full font-bold" variant="default">
                    <Link to={`/progress/${student.id}`}>
                      <TrendingUp className="mr-2 h-4 w-4" /> Show Progress
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Progress;