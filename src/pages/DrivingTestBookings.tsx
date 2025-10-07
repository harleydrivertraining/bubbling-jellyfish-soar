"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addMinutes } from "date-fns"; // Import addMinutes
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, CalendarDays, Clock, BookOpen, FilePlus, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EditBookingForm from "@/components/EditBookingForm";
import { Button } from "@/components/ui/button";
import AddDrivingTestForm from "@/components/AddDrivingTestForm";
import AddBookingForm from "@/components/AddBookingForm"; // Import AddBookingForm

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  student_id: string; // Added student_id
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

  const [isAddTestResultDialogOpen, setIsAddTestResultDialogOpen] = useState(false);
  const [bookingToRecordResult, setBookingToRecordResult] = useState<Booking | null>(null);

  // State for the new booking dialog
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [initialBookingSlot, setInitialBookingSlot] = useState<{ start: Date; end: Date } | null>(null);


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
      .select("id, title, description, start_time, end_time, status, lesson_type, student_id, students(name)")
      .eq("user_id", user.id)
      .eq("lesson_type", "Driving Test");

    if (selectedStudentId && selectedStudentId !== "all") {
      query = query.eq("student_id", selectedStudentId);
    }
    if (selectedStatus && selectedStatus !== "all") {
      query = query.eq("status", selectedStatus);
    }

    const { data, error } = await query.order("start_time", { ascending: false });

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
    fetchDrivingTestBookings();
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleBookingDeleted = () => {
    fetchDrivingTestBookings();
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleCloseEditBookingDialog = () => {
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleAddTestResultClick = (booking: Booking) => {
    setBookingToRecordResult(booking);
    setIsAddTestResultDialogOpen(true);
  };

  const handleTestResultAdded = () => {
    fetchDrivingTestBookings();
    setIsAddTestResultDialogOpen(false);
    setBookingToRecordResult(null);
  };

  const handleCloseAddTestResultDialog = () => {
    setIsAddTestResultDialogOpen(false);
    setBookingToRecordResult(null);
  };

  // Handler for opening the AddBookingForm dialog
  const handleOpenAddBookingDialog = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
    const defaultEndTime = addMinutes(defaultStartTime, 120); // Default to 2 hours lesson for driving test

    setInitialBookingSlot({ start: defaultStartTime, end: defaultEndTime });
    setIsAddBookingDialogOpen(true);
  };

  const handleNewBookingAdded = () => {
    fetchDrivingTestBookings(); // Refresh the list after a new booking is added
    setIsAddBookingDialogOpen(false);
    setInitialBookingSlot(null);
  };

  const handleCloseAddBookingDialog = () => {
    setIsAddBookingDialogOpen(false);
    setInitialBookingSlot(null);
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Driving Test Bookings</h1>
        <Dialog open={isAddBookingDialogOpen} onOpenChange={setIsAddBookingDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddBookingDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Test Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Driving Test Booking</DialogTitle>
            </DialogHeader>
            {initialBookingSlot && (
              <AddBookingForm
                initialStartTime={initialBookingSlot.start}
                initialEndTime={initialBookingSlot.end}
                onBookingAdded={handleNewBookingAdded}
                onClose={handleCloseAddBookingDialog}
                // Pre-fill lesson_type for driving test
                defaultValues={{ lesson_type: "Driving Test", lesson_length: "120" }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

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
            <Card key={booking.id} className="flex flex-col">
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
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditBookingClick(booking.id)}>
                    Edit Booking
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleAddTestResultClick(booking)}>
                    <FilePlus className="mr-2 h-4 w-4" /> Add Test Result
                  </Button>
                </div>
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

      <Dialog open={isAddTestResultDialogOpen} onOpenChange={handleCloseAddTestResultDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Driving Test Result</DialogTitle>
          </DialogHeader>
          {bookingToRecordResult && (
            <AddDrivingTestForm
              initialStudentId={bookingToRecordResult.student_id}
              initialTestDate={new Date(bookingToRecordResult.start_time)}
              onTestAdded={handleTestResultAdded}
              onClose={handleCloseAddTestResultDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrivingTestBookings;