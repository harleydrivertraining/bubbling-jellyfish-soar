import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { SessionContextProvider, useSession } from "./components/auth/SessionContextProvider";
import { initializePushNotifications } from "./utils/push-notifications";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Lessons = lazy(() => import("./pages/Lessons"));
const LessonNotes = lazy(() => import("./pages/LessonNotes"));
const StudentTargets = lazy(() => import("./pages/StudentTargets"));
const Progress = lazy(() => import("./pages/Progress"));
const StudentProgressDetail = lazy(() => import("./pages/StudentProgressDetail"));
const StudentProgressReport = lazy(() => import("./pages/StudentProgressReport"));
const StudentSelfAssessments = lazy(() => import("./pages/StudentSelfAssessments"));
const StudentCalendar = lazy(() => import("./pages/StudentCalendar"));
const DrivingTests = lazy(() => import("./pages/DrivingTests"));
const DrivingTestBookings = lazy(() => import("./pages/DrivingTestBookings"));
const PrePaidHours = lazy(() => import("./pages/PrePaidHours"));
const PrePaidHoursDetails = lazy(() => import("./pages/PrePaidHoursDetails"));
const ManageTopics = lazy(() => import("./pages/ManageTopics"));
const AdminProgressTopics = lazy(() => import("./pages/AdminProgressTopics"));
const AdminInstructors = lazy(() => import("./pages/AdminInstructors"));
const MileageTracker = lazy(() => import("./pages/MileageTracker"));
const TestStatistics = lazy(() => import("./pages/TestStatistics"));
const Support = lazy(() => import("./pages/Support"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const Accounts = lazy(() => import("./pages/Accounts"));
const PendingRequests = lazy(() => import("./pages/PendingRequests"));
const InstructorMessages = lazy(() => import("./pages/InstructorMessages"));
const TodoList = lazy(() => import("./pages/TodoList"));
const Subscription = lazy(() => import("./pages/Subscription"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const SignupSuccess = lazy(() => import("./pages/SignupSuccess"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PublicInstructorPage = lazy(() => import("./pages/PublicInstructorPage"));
const PublicProfileManagement = lazy(() => import("./pages/PublicProfileManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-10 w-48" />
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

const AppContent = () => {
  const { user } = useSession();

  useEffect(() => {
    if (user) {
      initializePushNotifications(user.id);
    }
  }, [user]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/74985" element={<Signup />} />
        <Route path="/signup-success" element={<SignupSuccess />} />
        
        {/* Public Instructor Route */}
        <Route path="/instructor/:identifier" element={<PublicInstructorPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:studentId" element={<StudentProfile />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="lesson-notes" element={<LessonNotes />} />
          <Route path="student-targets" element={<StudentTargets />} />
          <Route path="progress" element={<Progress />} />
          <Route path="progress/:studentId" element={<StudentProgressDetail />} />
          <Route path="progress-report" element={<StudentProgressReport />} />
          <Route path="pupil-self-assessments" element={<StudentSelfAssessments />} />
          <Route path="available-slots" element={<StudentCalendar />} />
          <Route path="driving-test-bookings" element={<DrivingTestBookings />} />
          <Route path="driving-tests" element={<DrivingTests />} />
          <Route path="test-statistics" element={<TestStatistics />} />
          <Route path="pre-paid-hours" element={<PrePaidHours />} />
          <Route path="pre-paid-hours/:packageId" element={<PrePaidHoursDetails />} />
          <Route path="manage-topics" element={<ManageTopics />} />
          <Route path="admin/topics" element={<AdminProgressTopics />} />
          <Route path="admin/instructors" element={<AdminInstructors />} />
          <Route path="mileage-tracker" element={<MileageTracker />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="support" element={<Support />} />
          <Route path="admin/support" element={<AdminSupport />} />
          <Route path="pending-requests" element={<PendingRequests />} />
          <Route path="messages" element={<InstructorMessages />} />
          <Route path="todo" element={<TodoList />} />
          <Route path="public-profile" element={<PublicProfileManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner closeButton />
      <BrowserRouter>
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;