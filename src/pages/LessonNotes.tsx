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
import { User, CalendarDays, BookOpen, Target } from "lucide-react";

interface LessonNote {
  id: string;
  title: string;
  description?: string;
  targets_for_next_session?: string;
  start_time: string; // ISO string
  students: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

// Helper function to check if a string has meaningful content
const hasContent = (text: string | null | undefined) => {
  return text != null && text.trim().length > 0;
};

const LessonNotes: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allLessonNotes, setAllLessonNotes] = useState<LessonNote[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all"); // "all" for all students
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("students")
      .select("id, name")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching students:", error);
      showError("Failed to load students for filter: " + error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
  }, [user]);

  const fetchLessonNotes = useCallback(async (studentId: string | null) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let query = supabase
      .from("bookings")
      .select("id, title, description, targets_for_next_session, start_time, students(name)")
      .eq("user_id", user.id);
      // Removed the .or() clause here to fetch all, then filter client-side more robustly

    if (studentId && studentId !== "all") {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query.order("start_time", { ascending: false }); // Most recent first

    if (error) {
      console.error("Error fetching lesson notes:", error);
      showError("Failed to load lesson notes: " + error.message);
      setAllLessonNotes([]);
    } else {
      // Client-side filter to ensure only bookings with actual content are shown
      const filteredData = (data || []).filter(
        (booking) => hasContent(booking.description) || hasContent(booking.targets_for_next_session)
      );
      setAllLessonNotes(filteredData);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [isSessionLoading, fetchStudents]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchLessonNotes(selectedStudentId);
    }
  }, [isSessionLoading, user, selectedStudentId, fetchLessonNotes]);

  const filteredLessonNotes = useMemo(() => {
    let currentNotes = [...allLessonNotes];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentNotes = currentNotes.filter(
        (note) =>
          note.students?.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
          note.title.toLowerCase().includes(lowerCaseSearchTerm) ||
          hasContent(note.description) && note.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
          hasContent(note.targets_for_next_session) && note.targets_for_next_session?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    return currentNotes;
  }, [allLessonNotes, searchTerm]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Lesson Notes</h1>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
        <Input
          placeholder="Search notes by student, title, or content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm sm:ml-auto"
        />
      </div>

      {filteredLessonNotes.length === 0 ? (
        <p className="text-muted-foreground">
          {allLessonNotes.length === 0
            ? "No lesson notes found yet. Schedule some lessons and add notes to them!"
            : "No lesson notes match your current filters or search term."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLessonNotes.map((note) => (
            <Card key={note.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  {note.students?.name || "Unknown Student"}
                </CardTitle>
                <CardDescription className="flex items-center text-muted-foreground">
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>{note.title}</span>
                </CardDescription>
                <CardDescription className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span>{format(new Date(note.start_time), "PPP p")}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                {hasContent(note.description) && (
                  <div>
                    <h3 className="font-semibold mb-1">Lesson Notes:</h3>
                    <p className="text-muted-foreground">{note.description}</p>
                  </div>
                )}
                {/* Removed Targets for Next Session */}
                {!hasContent(note.description) && (
                  <p className="text-muted-foreground italic">No specific notes recorded for this lesson.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonNotes;