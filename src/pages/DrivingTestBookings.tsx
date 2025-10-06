"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, CalendarDays, Clock, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditBookingForm from "@/components/EditBookingForm"; // Reusing the edit booking form

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  students: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

const DrivingTestBookings: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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

  const fetchDrivingTestBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let query = supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, status, lesson_type, students(name)")
      .eq("user_id", user.id)
      .eq("lesson_type", "Driving Test"); // Filter specifically for Driving Test bookings

    if (selectedStudentId && selectedStudentId !== "all") {
      query = query.eq("student_id", selectedStudentId);
    }
    if (selectedStatus && selectedStatus !== "all") {
      query = query.eq("status", selectedStatus);
    }

    const { data, error } = await query.order("start_time", { ascending: false }); // Most recent first

    if (error) {
      console.error("Error fetching driving test bookings:", error);
      showError("Failed to load driving test bookings: " + error.message);
      setBookings([]);
    } else {
      setBookings(data || []);
    }
    setIsLoading(false);
  }, [user, selectedStudentId, selectedStatus]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [isSessionLoading, fetchStudents]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchDrivingTestBookings();
    }
  }, [isSessionLoading, user, fetchDrivingTestBookings]);

  const handleEditBookingClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsEditBookingDialogOpen(true);
  };

  const handleBookingUpdated = () => {
    fetchDrivingTestBookings(); // Refresh the list after update
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleBookingDeleted = () => {
    fetchDrivingTestBookings(); // Refresh the list after deletion
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
      <h1 className="text-3xl font-bold">Driving Test Bookings</h1>
      <p className="text-muted-foreground">Manage your scheduled driving tests.</p>

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
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter">Filter by Status:</Label>
          <Select onValueChange={setSelectedStatus} defaultValue={selectedStatus}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="text-muted-foreground">No driving test bookings found. Go to the Schedule page to add one!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleEditBookingClick(booking.id)}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  {booking.students?.name || "Unknown Student"}
                </CardTitle>
                <CardDescription className="flex items-center text-muted-foreground">
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>{booking.title}</span>
                </CardDescription>
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
                <p className="text-sm font-medium mt-2">Status: <span className="capitalize">{booking.status}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditBookingDialogOpen} onOpenChange={handleCloseEditBookingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driving Test Booking</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (
            <EditBookingForm
              bookingId={selectedBookingId}
              onBookingUpdated={handleBookingUpdated}
              onBookingDeleted={handleBookingDeleted}
              onClose={handleCloseEditBookingDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrivingTestBookings;