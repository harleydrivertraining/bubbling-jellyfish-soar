import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { SessionContextProvider, useSession } from "./components/auth/SessionContextProvider";
import { initializePushNotifications } from "./utils/push-notifications";
import { Skeleton } from "./components/ui/skeleton";

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
const MileageTracker = lazy(() => import("./pages/MileageTracker"));
const TestStatistics = lazy(() => import("./pages/TestStatistics"));
const Support = lazy(() => import("./pages/Support"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const Accounts = lazy(() => import("./pages/Accounts"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
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
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
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
          <Route path="mileage-tracker" element={<MileageTracker />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="support" element={<Support />} />
          <Route path="admin/support" element={<AdminSupport />} />
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
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;