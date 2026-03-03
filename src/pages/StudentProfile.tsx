"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  CalendarDays, 
  GraduationCap, 
  MapPin, 
  Notebook, 
  Hourglass, 
  Edit,
  Clock,
  BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditStudentForm from "@/components/EditStudentForm";

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
  date_of_birth?: string;
  driving_license_number?: string;
  phone_number?: string;
  full_address?: string;
  notes?: string;
  is_past_student: boolean;
}

interface Booking {
  id: string;
  start_time: string;
  title: string;
  lesson_type: string;
}

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [totalPrepaidHours, setTotalPrepaidHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchStudentData = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);

    const now = new Date().toISOString();

    const [studentRes, hoursRes, bookingsRes] = await Promise.all([
      supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("pre_paid_hours")
        .select("remaining_hours")
        .eq("student_id", studentId)
        .eq("user_id", user.id),
      supabase
        .from("bookings")
        .select("id, start_time, title, lesson_type")
        .eq("student_id", studentId)
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gt("start_time", now)
        .order("start_time", { ascending: true })
        .limit(1)
    ]);

    if (studentRes.error) {
      console.error("Error fetching student:", studentRes.error);
      showError("Failed to load student profile.");
      navigate("/students");
    } else {
      setStudent(studentRes.data);
      
      const totalHours = hoursRes.data?.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0) || 0;
      setTotalPrepaidHours(totalHours);
      
      setNextBooking(bookingsRes.data?.[0] || null);
    }
    setIsLoading(false);
  }, [user, studentId, navigate]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudentData();
    }
  }, [isSessionLoading, fetchStudentData]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/students">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
          </Link>
        </Button>
        <Button onClick={() => setIsEditDialogOpen(true)}>
          <Edit className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{student.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={
                  student.status === "Beginner" ? "secondary" :
                  student.status === "Intermediate" ? "default" :
                  "outline"
                }>
                  {student.status}
                </Badge>
                {student.is_past_student && (
                  <Badge variant="outline" className="bg-muted">Past Student</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Phone Number</Label>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  {student.phone_number || "Not provided"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Date of Birth</Label>
                <div className="flex items-center text-sm">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  {student.date_of_birth ? format(new Date(student.date_of_birth), "PPP") : "Not provided"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">License Number</Label>
                <div className="flex items-center text-sm">
                  <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
                  {student.driving_license_number || "Not provided"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Address</Label>
                <div className="flex items-start text-sm">
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="flex-1">{student.full_address || "Not provided"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Notes</Label>
              <div className="flex items-start text-sm bg-muted/30 p-3 rounded-lg italic">
                <Notebook className="mr-2 h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p>{student.notes || "No notes recorded for this student."}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Sidebar */}
        <div className="space-y-6">
          <Card className="border-l-4 border-l-green-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Pre-Paid Credit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-3xl font-black text-green-600">
                <Hourglass className="mr-2 h-6 w-6" />
                {totalPrepaidHours.toFixed(1)} <span className="text-sm ml-1">hrs</span>
              </div>
              <Button variant="link" asChild className="p-0 h-auto text-xs mt-2">
                <Link to="/pre-paid-hours">Manage Hours</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Next Lesson</CardTitle>
            </CardHeader>
            <CardContent>
              {nextBooking ? (
                <div className="space-y-2">
                  <div className="flex items-center text-lg font-bold text-blue-600">
                    <Clock className="mr-2 h-5 w-5" />
                    {format(new Date(nextBooking.start_time), "MMM d, p")}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <BookOpen className="mr-1.5 h-3 w-3" />
                    {nextBooking.lesson_type}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No upcoming lessons scheduled.</p>
              )}
              <Button variant="link" asChild className="p-0 h-auto text-xs mt-2">
                <Link to="/schedule">View Schedule</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
          </DialogHeader>
          <EditStudentForm
            studentId={student.id}
            onStudentUpdated={() => { fetchStudentData(); setIsEditDialogOpen(false); }}
            onStudentDeleted={() => navigate("/students")}
            onClose={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentProfile;