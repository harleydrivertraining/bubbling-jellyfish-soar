"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BookOpen,
  CheckCircle2,
  History,
  TrendingUp,
  Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditStudentForm from "@/components/EditStudentForm";
import { cn } from "@/lib/utils";

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
  end_time: string;
  title: string;
  lesson_type: string;
  status: string;
}

interface ProgressEntry {
  topic_id: string;
  topic_name: string;
  rating: number;
  comment: string | null;
  entry_date: string;
}

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [totalPrepaidHours, setTotalPrepaidHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);

    try {
      const [studentRes, hoursRes, bookingsRes, progressRes, topicsRes] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId).single(),
        supabase.from("pre_paid_hours").select("remaining_hours").eq("student_id", studentId),
        supabase.from("bookings").select("*").eq("student_id", studentId).order("start_time", { ascending: false }),
        supabase.from("student_progress_entries").select("*, progress_topics(name)").eq("student_id", studentId).order("entry_date", { ascending: false }),
        supabase.from("progress_topics").select("*").eq("user_id", user.id)
      ]);

      if (studentRes.error) throw studentRes.error;
      setStudent(studentRes.data);
      
      const totalHours = hoursRes.data?.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0) || 0;
      setTotalPrepaidHours(totalHours);
      
      setBookings(bookingsRes.data || []);

      // Process progress: get latest entry for each topic
      const latestProgress: Record<string, ProgressEntry> = {};
      progressRes.data?.forEach(entry => {
        if (!latestProgress[entry.topic_id]) {
          latestProgress[entry.topic_id] = {
            topic_id: entry.topic_id,
            topic_name: (entry.progress_topics as any)?.name || "Unknown Topic",
            rating: entry.rating,
            comment: entry.comment,
            entry_date: entry.entry_date
          };
        }
      });
      setProgressEntries(Object.values(latestProgress));

    } catch (error: any) {
      console.error("Error fetching student data:", error);
      showError("Failed to load student profile.");
      navigate("/students");
    } finally {
      setIsLoading(false);
    }
  }, [user, studentId, navigate]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchData();
    }
  }, [isSessionLoading, fetchData]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!student) return null;

  const upcomingBookings = bookings.filter(b => isAfter(parseISO(b.start_time), new Date()) && b.status === 'scheduled').reverse();
  const pastBookings = bookings.filter(b => !isAfter(parseISO(b.start_time), new Date()) || b.status !== 'scheduled');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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

      {/* Header Summary */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-card p-6 rounded-xl border shadow-sm">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-black tracking-tight">{student.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={
              student.status === "Beginner" ? "secondary" :
              student.status === "Intermediate" ? "default" :
              "outline"
            }>
              {student.status}
            </Badge>
            {student.is_past_student && <Badge variant="outline" className="bg-muted">Past Student</Badge>}
            <Badge variant="outline" className={cn("font-bold", totalPrepaidHours > 0 ? "text-green-600 border-green-200 bg-green-50" : "text-destructive border-destructive/20 bg-destructive/5")}>
              <Hourglass className="mr-1 h-3 w-3" /> {totalPrepaidHours.toFixed(1)} hrs credit
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="summary" className="font-bold">Summary</TabsTrigger>
          <TabsTrigger value="lessons" className="font-bold">Lessons</TabsTrigger>
          <TabsTrigger value="progress" className="font-bold">Progress</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><User className="mr-2 h-5 w-5 text-primary" /> Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Phone</Label>
                    <div className="flex items-center text-sm font-medium">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      {student.phone_number || "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">DOB</Label>
                    <div className="flex items-center text-sm font-medium">
                      <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                      {student.date_of_birth ? format(new Date(student.date_of_birth), "PPP") : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">License No.</Label>
                    <div className="flex items-center text-sm font-medium">
                      <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
                      {student.driving_license_number || "N/A"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Address</Label>
                  <div className="flex items-start text-sm font-medium">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{student.full_address || "No address provided"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><Notebook className="mr-2 h-5 w-5 text-primary" /> Instructor Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 p-4 rounded-lg italic text-sm min-h-[100px]">
                  {student.notes || "No notes recorded for this student."}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lessons Tab */}
        <TabsContent value="lessons" className="mt-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center"><Clock className="mr-2 h-5 w-5 text-blue-600" /> Upcoming Lessons</h3>
            {upcomingBookings.length === 0 ? (
              <p className="text-muted-foreground italic bg-muted/20 p-4 rounded-lg">No upcoming lessons scheduled.</p>
            ) : (
              <div className="grid gap-3">
                {upcomingBookings.map(booking => (
                  <Card key={booking.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-bold">{format(new Date(booking.start_time), "EEEE, MMMM do")}</p>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Clock className="mr-1.5 h-3.5 w-3.5" /> {format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">{booking.lesson_type}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center"><History className="mr-2 h-5 w-5 text-muted-foreground" /> Past Lessons</h3>
            {pastBookings.length === 0 ? (
              <p className="text-muted-foreground italic">No past lessons recorded.</p>
            ) : (
              <div className="grid gap-3">
                {pastBookings.map(booking => (
                  <Card key={booking.id} className="opacity-80">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{format(new Date(booking.start_time), "MMM do, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{booking.lesson_type}</p>
                      </div>
                      <Badge variant={booking.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                        {booking.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" /> Proficiency Levels</h3>
            <Button asChild variant="outline" size="sm">
              <Link to={`/progress/${student.id}`}>Update Progress</Link>
            </Button>
          </div>

          {progressEntries.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No progress data recorded yet.</p>
              <Button asChild>
                <Link to={`/progress/${student.id}`}>Start Tracking Progress</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {progressEntries.map(entry => (
                <Card key={entry.topic_id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold">{entry.topic_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={cn("h-4 w-4", star <= entry.rating ? "fill-yellow-400 text-yellow-400" : "text-muted")} />
                      ))}
                    </div>
                    {entry.comment && (
                      <p className="text-sm text-muted-foreground italic line-clamp-2">"{entry.comment}"</p>
                    )}
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Last updated: {format(new Date(entry.entry_date), "MMM d, yyyy")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
          </DialogHeader>
          <EditStudentForm
            studentId={student.id}
            onStudentUpdated={() => { fetchData(); setIsEditDialogOpen(false); }}
            onStudentDeleted={() => navigate("/students")}
            onClose={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentProfile;