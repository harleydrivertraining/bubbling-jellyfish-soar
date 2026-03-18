"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Star,
  XCircle,
  CalendarCheck,
  PoundSterling,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Ban,
  CreditCard,
  Plus,
  ShieldCheck,
  MessageSquare,
  Save,
  ClipboardCheck,
  AlertTriangle,
  Hand,
  KeyRound,
  UserCheck,
  UserCircle,
  Lock,
  Send,
  Inbox
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, parseISO, differenceInMinutes, addMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditStudentForm from "@/components/EditStudentForm";
import AddBookingForm from "@/components/AddBookingForm";
import AddPrePaidHoursForm from "@/components/AddPrePaidHoursForm";
import EnableStudentLoginForm from "@/components/EnableStudentLoginForm";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";
import StarRatingInput from "@/components/StarRatingInput";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  auth_user_id?: string | null;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  lesson_type: string;
  status: string;
  is_paid?: boolean;
  is_covered?: boolean;
}

interface Topic {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProgressEntry {
  topic_id: string;
  topic_name: string;
  rating: number;
  comment: string | null;
  private_notes: string | null;
  entry_date: string;
  user_id: string;
}

interface DrivingTest {
  id: string;
  test_date: string;
  passed: boolean;
  driving_faults: number;
  serious_faults: number;
  examiner_action: boolean;
  notes?: string;
}

interface DirectMessage {
  id: string;
  content: string;
  created_at: string;
  is_broadcast: boolean;
}

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivingTests, setDrivingTests] = useState<DrivingTest[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progressEntries, setProgressEntries] = useState<Record<string, ProgressEntry>>({});
  const [selfAssessments, setSelfAssessments] = useState<ProgressEntry[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [totalPrepaidHours, setTotalPrepaidHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [isAddHoursDialogOpen, setIsAddHoursDialogOpen] = useState(false);
  const [isEnableLoginDialogOpen, setIsEnableLoginDialogOpen] = useState(false);
  const [activeLessonView, setActiveLessonView] = useState<'future' | 'past'>('future');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  
  // Messaging State
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);

    try {
      const [studentRes, hoursRes, bookingsRes, progressRes, transactionsRes, topicsRes, hiddenRes, testsRes, messagesRes] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId).single(),
        supabase.from("pre_paid_hours").select("remaining_hours").eq("student_id", studentId),
        supabase.from("bookings").select("*").eq("student_id", studentId).order("start_time", { ascending: false }),
        supabase.from("student_progress_entries").select("*, progress_topics(name)").eq("student_id", studentId).order("entry_date", { ascending: false }),
        supabase.from("pre_paid_hours_transactions").select("booking_id").eq("user_id", user.id),
        supabase.from("progress_topics").select("id, name, is_default").or(`user_id.eq.${user.id},is_default.eq.true`).order("is_default", { ascending: false }).order("name", { ascending: true }),
        supabase.from("hidden_progress_topics").select("topic_id").eq("user_id", user.id),
        supabase.from("driving_tests").select("*").eq("student_id", studentId).order("test_date", { ascending: false }),
        supabase.from("instructor_messages").select("*").eq("student_id", studentId).eq("instructor_id", user.id).order("created_at", { ascending: false })
      ]);

      if (studentRes.error) throw studentRes.error;
      const studentData = studentRes.data;
      setStudent(studentData);
      setDrivingTests(testsRes.data || []);
      setDirectMessages(messagesRes.data || []);
      
      const totalHours = hoursRes.data?.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0) || 0;
      setTotalPrepaidHours(totalHours);
      
      const paidViaCreditIds = new Set(transactionsRes.data?.map(t => t.booking_id) || []);
      
      let runningCredit = totalHours;
      const now = new Date();
      
      const sortedAllBookings = [...(bookingsRes.data || [])].sort((a, b) => 
        parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()
      );

      const coverageMap: Record<string, boolean> = {};
      sortedAllBookings.forEach(b => {
        const isFuture = isAfter(parseISO(b.start_time), now);
        const isScheduled = b.status === 'scheduled';
        const isAlreadyPaid = b.is_paid || paidViaCreditIds.has(b.id);

        if (isFuture && isScheduled && !isAlreadyPaid) {
          const duration = differenceInMinutes(new Date(b.end_time), new Date(b.start_time)) / 60;
          if (runningCredit >= duration) {
            coverageMap[b.id] = true;
            runningCredit -= duration;
          } else {
            coverageMap[b.id] = false;
          }
        }
      });

      const formattedBookings = (bookingsRes.data || []).map(b => ({
        ...b,
        is_paid: b.is_paid || paidViaCreditIds.has(b.id),
        is_covered: coverageMap[b.id] || false
      }));
      
      setBookings(formattedBookings);

      const hiddenIds = new Set((hiddenRes.data || []).map(h => h.topic_id));
      const visibleTopics = (topicsRes.data || []).filter(t => !hiddenIds.has(t.id));
      setTopics(visibleTopics);

      const latestInstructorProgress: Record<string, ProgressEntry> = {};
      const studentSelfAssessments: ProgressEntry[] = [];

      progressRes.data?.forEach(entry => {
        const formattedEntry = {
          topic_id: entry.topic_id,
          topic_name: (entry.progress_topics as any)?.name || "Unknown Topic",
          rating: entry.rating,
          comment: entry.comment,
          private_notes: entry.private_notes,
          entry_date: entry.entry_date,
          user_id: entry.user_id
        };

        if (entry.user_id === user.id) {
          if (!latestInstructorProgress[entry.topic_id]) {
            latestInstructorProgress[entry.topic_id] = formattedEntry;
          }
        } else if (studentData.auth_user_id && entry.user_id === studentData.auth_user_id) {
          studentSelfAssessments.push(formattedEntry);
        }
      });
      
      setProgressEntries(latestInstructorProgress);
      setSelfAssessments(studentSelfAssessments);

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

  const handleSendMessage = async () => {
    if (!user || !studentId || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from("instructor_messages")
        .insert({
          instructor_id: user.id,
          student_id: studentId,
          content: newMessage.trim(),
          is_broadcast: false
        });

      if (error) throw error;

      // Notify student
      if (student?.auth_user_id) {
        await supabase.from("notifications").insert({
          user_id: student.auth_user_id,
          title: "New Message",
          message: "Your instructor has sent you a private message.",
          type: "instructor_message"
        });
      }

      showSuccess("Message sent!");
      setNewMessage("");
      fetchData();
    } catch (error: any) {
      showError("Failed to send message: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelLesson = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: 'cancelled' })
      .eq("id", bookingId);

    if (error) {
      showError("Failed to cancel lesson: " + error.message);
    } else {
      showSuccess("Lesson cancelled.");
      fetchData();
    }
  };

  const handleMarkAsCompleted = async (booking: Booking) => {
    if (!user) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id);

    if (error) {
      showError("Failed to complete lesson: " + error.message);
    } else {
      showSuccess("Lesson marked as completed.");
      fetchData();
    }
  };

  const handleMarkAsPaid = async (booking: Booking) => {
    if (!user || !studentId) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ is_paid: true })
        .eq("id", booking.id);

      if (error) throw error;
      
      showSuccess("Lesson marked as paid.");
      fetchData();
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      showError("Failed to mark as paid: " + error.message);
    }
  };

  const updateStudentStatus = async (newEntries: Record<string, ProgressEntry>) => {
    if (!student || topics.length === 0) return;

    const totalPossibleStars = topics.length * 5;
    const totalEarnedStars = topics.reduce((sum, topic) => {
      const entry = newEntries[topic.id];
      return sum + (entry ? entry.rating : 0);
    }, 0);
    
    const percentage = Math.round((totalEarnedStars / totalPossibleStars) * 100);
    
    let newStatus: "Beginner" | "Intermediate" | "Advanced" = "Beginner";
    if (percentage >= 90) newStatus = "Advanced";
    else if (percentage >= 50) newStatus = "Intermediate";

    if (newStatus !== student.status) {
      const { error } = await supabase
        .from("students")
        .update({ status: newStatus })
        .eq("id", student.id);
      
      if (!error) {
        setStudent(prev => prev ? { ...prev, status: newStatus } : null);
        showSuccess(`Student status automatically updated to ${newStatus}!`);
      }
    }
  };

  const saveProgressEntry = async (topicId: string, ratingOverride?: number) => {
    if (!user || !studentId) return;
    
    const currentEntry = progressEntries[topicId] || { topic_id: topicId, rating: 0, comment: "", private_notes: "", user_id: user.id, topic_name: "", entry_date: "" };
    const rating = ratingOverride !== undefined ? ratingOverride : currentEntry.rating;
    const comment = currentEntry.comment;
    const private_notes = currentEntry.private_notes;

    if (rating === 0) {
      showError("Please select a star rating.");
      return;
    }

    setSavingTopicId(topicId);
    const { error } = await supabase
      .from("student_progress_entries")
      .insert({
        user_id: user.id,
        student_id: studentId,
        topic_id: topicId,
        rating: rating,
        comment: comment,
        private_notes: private_notes,
        entry_date: new Date().toISOString()
      });

    if (error) {
      showError("Failed to save progress: " + error.message);
    } else {
      const updatedEntries = {
        ...progressEntries,
        [topicId]: { 
          topic_id: topicId, 
          topic_name: topics.find(t => t.id === topicId)?.name || "Unknown",
          rating, 
          comment,
          private_notes,
          entry_date: new Date().toISOString(),
          user_id: user.id
        }
      };
      setProgressEntries(updatedEntries);
      
      if (ratingOverride !== undefined) {
        showSuccess("Rating saved!");
      } else {
        showSuccess("Notes saved!");
        setExpandedTopicId(null);
      }

      updateStudentStatus(updatedEntries);
    }
    setSavingTopicId(null);
  };

  const handleRatingChange = (topicId: string, newRating: number) => {
    saveProgressEntry(topicId, newRating);
  };

  const handleFieldChange = (topicId: string, field: 'comment' | 'private_notes', value: string) => {
    setProgressEntries(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || { topic_id: topicId, topic_name: "", rating: 0, comment: "", private_notes: "", entry_date: "", user_id: user?.id || "" }),
        [field]: value
      }
    }));
  };

  const lessonStats = useMemo(() => {
    const now = new Date();
    let delivered = 0;
    let cancelled = 0;
    let booked = 0;

    bookings.forEach(b => {
      const duration = differenceInMinutes(new Date(b.end_time), new Date(b.start_time)) / 60;
      if (b.status === 'completed') {
        delivered += duration;
      } else if (b.status === 'cancelled') {
        cancelled += duration;
      } else if (b.status === 'scheduled' && isAfter(parseISO(b.start_time), now)) {
        booked += duration;
      }
    });

    return { delivered, cancelled, booked };
  }, [bookings]);

  const completionPercentage = useMemo(() => {
    if (topics.length === 0) return 0;
    const totalPossibleStars = topics.length * 5;
    const totalEarnedStars = topics.reduce((sum, topic) => {
      const entry = progressEntries[topic.id];
      return sum + (entry ? entry.rating : 0);
    }, 0);
    return Math.round((totalEarnedStars / totalPossibleStars) * 100);
  }, [topics, progressEntries]);

  const SummaryCards = () => (
    <React.Fragment>
      <Card className="bg-green-50 border-green-100 shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
          <CheckCircle2 className="h-5 w-5 text-green-600 mb-1" />
          <p className="text-[10px] font-bold uppercase text-green-700">Delivered</p>
          <p className="text-2xl font-black text-green-900">{lessonStats.delivered.toFixed(1)}h</p>
        </CardContent>
      </Card>
      <Card className="bg-blue-50 border-blue-100 shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
          <CalendarCheck className="h-5 w-5 text-blue-600 mb-1" />
          <p className="text-[10px] font-bold uppercase text-blue-700">Booked</p>
          <p className="text-2xl font-black text-blue-900">{lessonStats.booked.toFixed(1)}h</p>
        </CardContent>
      </Card>
      <Card className="bg-orange-50 border-orange-100 shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
          <XCircle className="h-5 w-5 text-orange-600 mb-1" />
          <p className="text-[10px] font-bold uppercase text-orange-700">Cancelled</p>
          <p className="text-2xl font-black text-orange-900">{lessonStats.cancelled.toFixed(1)}h</p>
        </CardContent>
      </Card>
      <Card className={cn("border-l-4 shadow-sm", totalPrepaidHours > 0 ? "bg-primary/5 border-l-primary" : "bg-destructive/5 border-l-destructive")}>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
          <Hourglass className={cn("h-5 w-5 mb-1", totalPrepaidHours > 0 ? "text-primary" : "text-destructive")} />
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Credit Left</p>
          <p className={cn("text-2xl font-black", totalPrepaidHours > 0 ? "text-primary" : "text-destructive")}>{totalPrepaidHours.toFixed(1)}h</p>
        </CardContent>
      </Card>
    </React.Fragment>
  );

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

  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
  const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
  const defaultEndTime = addMinutes(defaultStartTime, 60);

  return (
    <div className="space-y-6 max-w-5xl mx-auto relative min-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/students">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
          </Link>
        </Button>
        <div className="flex gap-2">
          {!student.auth_user_id && (
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setIsEnableLoginDialogOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" /> Enable Login
            </Button>
          )}
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-1 bg-card p-6 rounded-xl border shadow-sm flex flex-col justify-center">
          <div className="space-y-2">
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
              {student.auth_user_id && (
                <Badge variant="default" className="bg-green-600">
                  <UserCheck className="mr-1 h-3 w-3" /> Login Active
                </Badge>
              )}
            </div>
            
            <div className="lg:hidden pt-1">
              <div className={cn(
                "flex items-center font-bold text-sm",
                totalPrepaidHours > 0 ? "text-green-600" : "text-destructive"
              )}>
                <Hourglass className="mr-1.5 h-3.5 w-3.5" />
                {totalPrepaidHours.toFixed(1)} hrs credit
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:grid lg:col-span-2 grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCards />
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="summary" className="font-bold">Summary</TabsTrigger>
          <TabsTrigger value="lessons" className="font-bold">Lessons</TabsTrigger>
          <TabsTrigger value="progress" className="font-bold">Progress</TabsTrigger>
          <TabsTrigger value="messages" className="font-bold">Messages</TabsTrigger>
          <TabsTrigger value="self" className="font-bold">Self</TabsTrigger>
        </TabsList>

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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <ClipboardCheck className="mr-2 h-5 w-5 text-primary" /> 
                Previous Driving Test Results
              </CardTitle>
              <CardDescription>History of all driving test attempts.</CardDescription>
            </CardHeader>
            <CardContent>
              {drivingTests.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4">No driving test records found for this student.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {drivingTests.map((test) => (
                    <div key={test.id} className={cn(
                      "p-4 rounded-lg border-l-4 shadow-sm",
                      test.passed ? "bg-green-50 border-l-green-500" : "bg-red-50 border-l-red-500"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-bold">{format(new Date(test.test_date), "PPP")}</span>
                        </div>
                        <Badge variant={test.passed ? "default" : "destructive"} className={cn(test.passed && "bg-green-600")}>
                          {test.passed ? "PASSED" : "FAILED"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          <span>Driving Faults: <strong>{test.driving_faults}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Serious Faults: <strong>{test.serious_faults}</strong></span>
                        </div>
                        {test.examiner_action && (
                          <div className="flex items-center gap-1 text-orange-600 col-span-2">
                            <Hand className="h-3 w-3" />
                            <span>Examiner Action Taken</span>
                          </div>
                        )}
                      </div>
                      
                      {test.notes && (
                        <p className="mt-2 text-xs italic text-muted-foreground border-t pt-2">
                          "{test.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons" className="mt-6 space-y-8">
          <div className="grid lg:hidden grid-cols-2 gap-4 mb-6">
            <SummaryCards />
          </div>

          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit mx-auto">
            <Button 
              variant={activeLessonView === 'future' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveLessonView('future')}
              className="font-bold"
            >
              <Clock className="mr-2 h-4 w-4" /> Future Lessons
            </Button>
            <Button 
              variant={activeLessonView === 'past' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveLessonView('past')}
              className="font-bold"
            >
              <History className="mr-2 h-4 w-4" /> Past Lessons
            </Button>
          </div>

          {activeLessonView === 'future' ? (
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center"><Clock className="mr-2 h-5 w-5 text-blue-600" /> Upcoming Lessons</h3>
              {upcomingBookings.length === 0 ? (
                <p className="text-muted-foreground italic bg-muted/20 p-4 rounded-lg">No upcoming lessons scheduled.</p>
              ) : (
                <div className="grid gap-4">
                  {upcomingBookings.map(booking => {
                    const duration = differenceInMinutes(new Date(booking.end_time), new Date(booking.start_time)) / 60;
                    const isExpanded = expandedLessonId === booking.id;
                    
                    return (
                      <Card key={booking.id} className="overflow-hidden border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0 border shadow-sm">
                              <span className="text-lg font-black leading-none">{duration.toFixed(1)}</span>
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">Hours</span>
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-bold text-lg truncate">{format(new Date(booking.start_time), "EEEE, MMMM do")}</p>
                              <p className="text-sm text-muted-foreground flex items-center">
                                <Clock className="mr-1.5 h-3.5 w-3.5" /> {format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <div className="flex items-center gap-1.5 text-blue-600 border border-blue-200 bg-blue-50/50 px-2 py-0.5 rounded-full">
                                  <CalendarCheck className="h-3.5 w-3.5" />
                                  <span className="text-[9px] font-bold uppercase tracking-tight">Booked</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground border border-muted px-2 py-0.5 rounded-full">
                                  {booking.lesson_type === 'Driving Test' ? <Car className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                                  <span className="text-[9px] font-bold uppercase tracking-tight">{booking.lesson_type}</span>
                                </div>
                                
                                {booking.is_paid ? (
                                  <div className="flex items-center gap-1.5 border border-green-200 bg-green-50/50 px-2 py-0.5 rounded-full text-green-600">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-tight">Paid</span>
                                  </div>
                                ) : booking.is_covered ? (
                                  <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/5 px-2 py-0.5 rounded-full text-primary">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-tight">Covered</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 border border-destructive/20 bg-destructive/5 px-2 py-0.5 rounded-full text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-tight">Unpaid</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setExpandedLessonId(isExpanded ? null : booking.id)}
                              className="rounded-full"
                            >
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-200">
                              <Button 
                                variant="outline" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/5 font-bold"
                                onClick={() => handleCancelLesson(booking.id)}
                              >
                                <Ban className="mr-2 h-4 w-4" /> Cancel
                              </Button>
                              <Button 
                                variant="outline" 
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 font-bold"
                                disabled={booking.is_paid}
                                onClick={() => handleMarkAsPaid(booking)}
                              >
                                <CreditCard className="mr-2 h-4 w-4" /> {booking.is_paid ? "Paid" : "Pay"}
                              </Button>
                              <Button 
                                variant="default" 
                                className="font-bold"
                                onClick={() => handleMarkAsCompleted(booking)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> Complete
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
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
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" /> Course Completion</h3>
                <span className="text-2xl font-black text-green-600">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>
            <Button asChild variant="outline" size="sm" className="font-bold shrink-0">
              <Link to={`/progress/${student.id}`}>Full Tracker</Link>
            </Button>
          </div>

          {topics.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No progress topics available.</p>
              <Button asChild>
                <Link to="/manage-topics">Manage Topics</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {topics.map(topic => {
                const entry = progressEntries[topic.id] || { rating: 0, comment: "", private_notes: "", user_id: user?.id || "", topic_id: topic.id, topic_name: topic.name, entry_date: "" };
                const isSaving = savingTopicId === topic.id;
                const isExpanded = expandedTopicId === topic.id;

                return (
                  <Card key={topic.id} className={cn(
                    "overflow-hidden transition-all duration-200 border-l-4 flex flex-col",
                    entry.rating > 0 ? "border-l-green-500" : "border-l-muted",
                    isExpanded && "col-span-2"
                  )}>
                    <div className={cn(
                      "p-3 sm:p-4 flex flex-col h-full",
                      isExpanded && "sm:flex-row sm:items-center sm:justify-between"
                    )}>
                      <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm sm:text-lg font-bold truncate">{topic.name}</h3>
                          {topic.is_default && <Badge variant="secondary" className="text-[8px] sm:text-[10px] h-3 sm:h-4 px-1">DEFAULT</Badge>}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                          <StarRatingInput 
                            value={entry.rating} 
                            onChange={(val) => handleRatingChange(topic.id, val)} 
                            disabled={isSaving}
                          />
                          {isSaving && savingTopicId === topic.id && (
                            <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground animate-pulse uppercase">Saving...</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 mt-auto sm:mt-0">
                        {(entry.comment || entry.private_notes) && !isExpanded && (
                          <div className="flex gap-1">
                            {entry.comment && (
                              <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground text-[10px] px-1.5 py-0">
                                <MessageSquare className="h-3 w-3" />
                              </Badge>
                            )}
                            {entry.private_notes && (
                              <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-200 bg-blue-50 text-[10px] px-1.5 py-0">
                                <Lock className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                          className="h-8 w-8 rounded-full"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-4 pt-2 border-t">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                              <MessageSquare className="mr-1 h-3 w-3" /> Notes for Pupil (Public)
                            </Label>
                            <Textarea 
                              placeholder="Feedback the student can see..." 
                              value={entry.comment || ""} 
                              onChange={(e) => handleFieldChange(topic.id, 'comment', e.target.value)} 
                              className="min-h-[80px] bg-muted/30" 
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-blue-600 flex items-center">
                              <Lock className="mr-1 h-3 w-3" /> Instructor Notes (Private)
                            </Label>
                            <Textarea 
                              placeholder="Private notes for your eyes only..." 
                              value={entry.private_notes || ""} 
                              onChange={(e) => handleFieldChange(topic.id, 'private_notes', e.target.value)} 
                              className="min-h-[80px] bg-blue-50/30 border-blue-100" 
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button 
                              onClick={() => saveProgressEntry(topic.id)} 
                              disabled={isSaving} 
                              size="sm"
                              className="font-bold"
                            >
                              {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save All Notes</>}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6 space-y-6">
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Direct Messaging
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">Send a private message or announcement to {student.name}.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">New Message</Label>
                  <Textarea 
                    placeholder="Type your message here..." 
                    className="min-h-[100px] resize-none"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button 
                    className="font-bold" 
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage.trim()}
                  >
                    {isSending ? "Sending..." : <><Send className="mr-2 h-4 w-4" /> Send Message</>}
                  </Button>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                  <History className="h-4 w-4" /> Message History
                </h3>
                {directMessages.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground italic text-sm">No direct messages sent yet.</p>
                ) : (
                  <div className="space-y-4">
                    {directMessages.map((msg) => (
                      <div key={msg.id} className="bg-muted/30 p-4 rounded-xl border border-muted space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={msg.is_broadcast ? "default" : "outline"} className="text-[8px] font-bold uppercase">
                            {msg.is_broadcast ? "Broadcast" : "Private"}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            {format(parseISO(msg.created_at), "MMM d, p")}
                          </span>
                        </div>
                        <p className="text-sm italic">"{msg.content}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="self" className="mt-6 space-y-6">
          <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-primary">Pupil Self-Assessments</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Review how {student.name} rates their own skills and confidence. These entries are created by the student through their own dashboard.
            </p>
          </div>

          {selfAssessments.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">No self-assessments submitted by this student yet.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {selfAssessments.map((assessment, index) => (
                <Card key={`${assessment.topic_id}-${index}`} className="flex flex-col border-l-4 border-l-primary bg-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-bold">{assessment.topic_name}</CardTitle>
                      <Badge variant="default" className="text-[10px] font-bold uppercase">Pupil Rating</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={cn(
                            "h-4 w-4", 
                            i < assessment.rating ? "fill-yellow-400 text-yellow-400" : "text-muted/30"
                          )} 
                        />
                      ))}
                      <span className="text-xs font-bold text-muted-foreground ml-2">{assessment.rating}/5</span>
                    </div>

                    {assessment.comment && (
                      <div className="bg-background/80 p-3 rounded-lg border border-primary/10 italic text-sm relative">
                        <MessageSquare className="h-3 w-3 text-primary/40 absolute -top-1.5 -left-1.5 bg-background rounded-full" />
                        "{assessment.comment}"
                      </div>
                    )}

                    <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase pt-2 border-t border-primary/10">
                      <CalendarDays className="mr-1 h-3 w-3" />
                      Submitted {format(parseISO(assessment.entry_date), "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className={cn(
        "fixed z-50",
        isMobile ? "bottom-28 right-6" : "bottom-10 right-10"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-xl border-4 border-white"
            >
              <Plus className="h-8 w-8 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 mb-2">
            <DropdownMenuItem 
              className="py-3 cursor-pointer font-bold"
              onClick={() => setIsAddBookingDialogOpen(true)}
            >
              <CalendarCheck className="mr-2 h-5 w-5 text-blue-600" />
              Add Booking
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="py-3 cursor-pointer font-bold"
              onClick={() => setIsAddHoursDialogOpen(true)}
            >
              <Hourglass className="mr-2 h-5 w-5 text-green-600" />
              Add Pre-paid Hours
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

      <Dialog open={isAddBookingDialogOpen} onOpenChange={setIsAddBookingDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Booking for {student.name}</DialogTitle>
          </DialogHeader>
          <AddBookingForm
            initialStartTime={defaultStartTime}
            initialEndTime={defaultEndTime}
            onBookingAdded={() => { fetchData(); setIsAddBookingDialogOpen(false); }}
            onClose={() => setIsAddBookingDialogOpen(false)}
            defaultValues={{ student_id: student.id }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddHoursDialogOpen} onOpenChange={setIsAddHoursDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Pre-paid Hours for {student.name}</DialogTitle>
          </DialogHeader>
          <AddPrePaidHoursForm
            onHoursAdded={() => { fetchData(); setIsAddHoursDialogOpen(false); }}
            onClose={() => setIsAddHoursDialogOpen(false)}
            initialStudentId={student.id}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEnableLoginDialogOpen} onOpenChange={setIsEnableLoginDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Enable Student Login</DialogTitle>
          </DialogHeader>
          <EnableStudentLoginForm 
            studentId={student.id}
            studentPhone={student.phone_number || ""}
            studentName={student.name}
            onSuccess={() => { fetchData(); setIsEnableLoginDialogOpen(false); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentProfile;