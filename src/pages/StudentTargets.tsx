"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, CalendarDays, Target } from "lucide-react";

interface StudentTargetNote {
  id: string;
  title: string;
  description?: string;
  targets_for_next_session?: string;
  start_time: string;
  students: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

const hasContent = (text: string | null | undefined) => {
  return text != null && text.trim().length > 0;
};

const StudentTargets: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const [allStudentTargets, setAllStudentTargets] = useState<StudentTargetNote[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStudents = useCallback(async () => {
    if (!user || profile?.role === 'student') return;
    const { data, error } = await supabase
      .from("students")
      .select("id, name")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
  }, [user, profile?.role]);

  const fetchStudentTargets = useCallback(async (studentId: string | null) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let query = supabase
      .from("bookings")
      .select("id, title, description, targets_for_next_session, start_time, students(name)");

    if (profile?.role === 'student') {
      const { data: studentRec } = await supabase.from("students").select("id").eq("auth_user_id", user.id).single();
      if (studentRec) {
        query = query.eq("student_id", studentRec.id);
      } else {
        setAllStudentTargets([]);
        setIsLoading(false);
        return;
      }
    } else {
      query = query.eq("user_id", user.id);
      if (studentId && studentId !== "all") {
        query = query.eq("student_id", studentId);
      }
    }

    const { data, error } = await query.order("start_time", { ascending: false });

    if (error) {
      console.error("Error fetching student targets:", error);
      showError("Failed to load targets.");
      setAllStudentTargets([]);
    } else {
      const filteredData = (data || []).filter(
        (booking) => hasContent(booking.targets_for_next_session)
      );
      setAllStudentTargets(filteredData as any);
    }
    setIsLoading(false);
  }, [user, profile?.role]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
      fetchStudentTargets(selectedStudentId);
    }
  }, [isSessionLoading, fetchStudents, fetchStudentTargets, selectedStudentId]);

  const filteredStudentTargets = useMemo(() => {
    let currentTargets = [...allStudentTargets];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentTargets = currentTargets.filter(
        (targetNote) =>
          targetNote.students?.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
          targetNote.title.toLowerCase().includes(lowerCaseSearchTerm) ||
          (hasContent(targetNote.targets_for_next_session) && targetNote.targets_for_next_session?.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    return currentTargets;
  }, [allStudentTargets, searchTerm]);

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{profile?.role === 'student' ? 'My Targets' : 'Student Targets'}</h1>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {profile?.role !== 'student' && (
          <div className="flex items-center gap-2">
            <Label htmlFor="student-filter">Filter by Student:</Label>
            <Select onValueChange={setSelectedStudentId} defaultValue={selectedStudentId}>
              <SelectTrigger id="student-filter" className="w-[180px]">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Input
          placeholder="Search targets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm sm:ml-auto"
        />
      </div>

      {filteredStudentTargets.length === 0 ? (
        <p className="text-muted-foreground">No targets found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudentTargets.map((targetNote) => (
            <Card key={targetNote.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  {targetNote.students?.name || "Unknown Student"}
                </CardTitle>
                <CardDescription className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span>{format(new Date(targetNote.start_time), "PPP p")}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold mb-1 flex items-center">
                    <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                    Targets for Next Session:
                  </h3>
                  <p className="text-muted-foreground">{targetNote.targets_for_next_session}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentTargets;