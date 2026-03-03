"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, ChevronRight, Hourglass, CalendarDays, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddStudentForm from "@/components/AddStudentForm";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
  is_past_student: boolean;
  total_prepaid_hours: number;
  next_booking?: {
    start_time: string;
    title: string;
  } | null;
}

const Students: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showPastStudents, setShowPastStudents] = useState<string>("current");

  const fetchStudents = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const now = new Date().toISOString();
    
    const [studentsRes, hoursRes, bookingsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, status, is_past_student")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("pre_paid_hours")
        .select("student_id, remaining_hours")
        .eq("user_id", user.id),
      supabase
        .from("bookings")
        .select("student_id, start_time, title")
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gt("start_time", now)
        .order("start_time", { ascending: true })
    ]);

    if (studentsRes.error) {
      console.error("Error fetching students:", studentsRes.error);
      showError("Failed to load students: " + studentsRes.error.message);
      setStudents([]);
    } else {
      const hoursMap: Record<string, number> = {};
      hoursRes.data?.forEach(pkg => {
        hoursMap[pkg.student_id] = (hoursMap[pkg.student_id] || 0) + (pkg.remaining_hours || 0);
      });

      const nextBookingMap: Record<string, { start_time: string; title: string }> = {};
      bookingsRes.data?.forEach(booking => {
        if (booking.student_id && !nextBookingMap[booking.student_id]) {
          nextBookingMap[booking.student_id] = {
            start_time: booking.start_time,
            title: booking.title
          };
        }
      });

      const formattedStudents: Student[] = (studentsRes.data || []).map((student: any) => ({
        ...student,
        total_prepaid_hours: hoursMap[student.id] || 0,
        next_booking: nextBookingMap[student.id] || null
      }));
      
      setStudents(formattedStudents);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [user, isSessionLoading, fetchStudents]);

  const handleViewProfile = (studentId: string) => {
    navigate(`/students/${studentId}`);
  };

  const filteredStudents = useMemo(() => {
    let currentStudents = [...students];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentStudents = currentStudents.filter((student) =>
        student.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (selectedStatus !== "all") {
      currentStudents = currentStudents.filter((student) =>
        student.status === selectedStatus
      );
    }

    if (showPastStudents === "current") {
      currentStudents = currentStudents.filter((student) => !student.is_past_student);
    } else if (showPastStudents === "past") {
      currentStudents = currentStudents.filter((student) => student.is_past_student);
    }

    return currentStudents;
  }, [students, searchTerm, selectedStatus, showPastStudents]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Students</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        
        <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-1 sm:flex-none items-center gap-2">
            <Label htmlFor="status-filter" className="hidden sm:inline whitespace-nowrap">Status:</Label>
            <Select onValueChange={setSelectedStatus} defaultValue={selectedStatus}>
              <SelectTrigger id="status-filter" className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-1 sm:flex-none items-center gap-2">
            <Label htmlFor="past-student-filter" className="hidden sm:inline whitespace-nowrap">View:</Label>
            <Select onValueChange={setShowPastStudents} defaultValue={showPastStudents}>
              <SelectTrigger id="past-student-filter" className="w-full sm:w-[150px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredStudents.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No students found.</p>
        ) : (
          filteredStudents.map((student) => (
            <Card key={student.id} className={cn(
              "overflow-hidden transition-all hover:shadow-md cursor-pointer",
              student.is_past_student && "opacity-70 bg-muted/30"
            )} onClick={() => handleViewProfile(student.id)}>
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold truncate">{student.name}</h3>
                    {student.is_past_student && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">PAST</Badge>
                    )}
                    <Badge variant={
                      student.status === "Beginner" ? "secondary" :
                      student.status === "Intermediate" ? "default" :
                      "outline"
                    } className="text-[10px] h-4 px-1">
                      {student.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {student.next_booking ? (
                      <div className="flex items-center text-blue-600 font-medium">
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                        Next: {format(new Date(student.next_booking.start_time), "MMM d, p")}
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">No upcoming lessons</div>
                    )}
                    
                    {student.total_prepaid_hours > 0 && (
                      <div className="flex items-center text-green-600 font-bold">
                        <Hourglass className="mr-1.5 h-3.5 w-3.5" />
                        {student.total_prepaid_hours.toFixed(1)} hrs credit
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-4 rounded-full hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewProfile(student.id);
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <AddStudentForm onStudentAdded={() => { fetchStudents(); setIsAddDialogOpen(false); }} onClose={() => setIsAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;