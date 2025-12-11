"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CalendarDays, Clock, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Import Dialog components
import EditBookingForm from "@/components/EditBookingForm"; // Import EditBookingForm

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  status: string;
  students: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

const Lessons: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all"); // "all" for all students

  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false); // New state
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null); // New state

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

  const fetchBookings = useCallback(async (studentId: string | null) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let query = supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, status, students(name)")
      .eq("user_id", user.id);

    if (studentId && studentId !== "all") {
      query = query.eq("student_id", studentId);
    }

    // Only show completed lessons for this page
    query = query.eq("status", "completed"); // Filter for completed lessons

    const { data, error } = await query.order("start_time", { ascending: false }); // Most recent completed first

    if (error) {
      console.error("Error fetching bookings:", error);
      showError("Failed to load lessons: " + error.message);
      setBookings([]);
    } else {
      setBookings(data || []);
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
      fetchBookings(selectedStudentId);
    }
  }, [isSessionLoading, user, selectedStudentId, fetchBookings]);

  const handleEditBookingClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsEditBookingDialogOpen(true);
  };

  const handleBookingUpdatedOrDeleted = () => {
    fetchBookings(selectedStudentId); // Re-fetch bookings to update the list
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleCloseEditBookingDialog = () => {
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Completed Lessons</h1> {/* Changed title */}

      <div className="flex items-center gap-4">
        <Label>Filter by Student:</Label>
        <Select onValueChange={setSelectedStudentId} defaultValue={selectedStudentId}>
          <SelectTrigger className="w-[180px]">
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

      {bookings.length === 0 ? (
        <p className="text-muted-foreground">No completed lessons found. Mark lessons as completed in the Schedule page to see them here.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleEditBookingClick(booking.id)}>
              <CardHeader>
                <CardTitle className="text-lg">{booking.title}</CardTitle>
                {booking.students?.name && (
                  <CardDescription className="flex items-center text-muted-foreground">
                    <User className="mr-2 h-4 w-4" />
                    <span>Student: {booking.students.name}</span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                {booking.description && (
                  <p className="text-muted-foreground italic">{booking.description}</p>
                )}
                <div className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span>{format(new Date(booking.start_time), "PPP")}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>
                    {format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}
                  </span>
                </div>
                {/* You can add more details like status here if needed */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditBookingDialogOpen} onOpenChange={handleCloseEditBookingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (
            <EditBookingForm
              bookingId={selectedBookingId}
              onBookingUpdated={handleBookingUpdatedOrDeleted}
              onBookingDeleted={handleBookingUpdatedOrDeleted}
              onClose={handleCloseEditBookingDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lessons;