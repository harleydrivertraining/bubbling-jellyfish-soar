"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import StudentProgressCard from "@/components/StudentProgressCard"; // Import the new component

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
}

interface Booking {
  id: string;
  student_id: string;
  start_time: string;
  description?: string;
  targets_for_next_session?: string;
  status: "scheduled" | "completed" | "cancelled";
}

interface StudentProgressData extends Student {
  latestBookingInfo?: {
    id: string;
    start_time: string;
    description?: string;
    targets_for_next_session?: string;
  };
}

const Progress: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allStudentsProgress, setAllStudentsProgress] = useState<StudentProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const fetchStudentProgress = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("id, name, status")
      .eq("user_id", user.id);

    if (studentsError) {
      console.error("Error fetching students for progress:", studentsError);
      showError("Failed to load students: " + studentsError.message);
      setAllStudentsProgress([]);
      setIsLoading(false);
      return;
    }

    const studentsWithProgress: StudentProgressData[] = [];

    for (const student of studentsData || []) {
      const { data: latestBooking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, start_time, description, targets_for_next_session, status")
        .eq("student_id", student.id)
        .eq("user_id", user.id)
        .eq("status", "completed") // Only consider completed lessons for progress
        .order("start_time", { ascending: false })
        .limit(1)
        .single();

      studentsWithProgress.push({
        ...student,
        latestBookingInfo: latestBooking ? {
          id: latestBooking.id,
          start_time: latestBooking.start_time,
          description: latestBooking.description,
          targets_for_next_session: latestBooking.targets_for_next_session,
        } : undefined,
      });
    }

    setAllStudentsProgress(studentsWithProgress);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudentProgress();
    }
  }, [isSessionLoading, fetchStudentProgress]);

  const filteredStudentsProgress = useMemo(() => {
    let currentProgress = [...allStudentsProgress];

    // Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentProgress = currentProgress.filter(
        (student) =>
          student.name.toLowerCase().includes(lowerCaseSearchTerm) ||
          (student.latestBookingInfo?.description?.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (student.latestBookingInfo?.targets_for_next_session?.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // Filter by status
    if (selectedStatus !== "all") {
      currentProgress = currentProgress.filter((student) =>
        student.status === selectedStatus
      );
    }

    return currentProgress;
  }, [allStudentsProgress, searchTerm, selectedStatus]);

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
      <h1 className="text-3xl font-bold">Student Progress</h1>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Input
          placeholder="Search students or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter">Status:</Label>
          <Select onValueChange={setSelectedStatus} defaultValue={selectedStatus}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredStudentsProgress.length === 0 && allStudentsProgress.length > 0 && (
        <p className="text-muted-foreground col-span-full">No students match your search or filter criteria.</p>
      )}
      {allStudentsProgress.length === 0 ? (
        <p className="text-muted-foreground">No students added yet. Go to the Students page to add one!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudentsProgress.map((student) => (
            <StudentProgressCard
              key={student.id}
              student={student}
              latestBookingInfo={student.latestBookingInfo}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Progress;