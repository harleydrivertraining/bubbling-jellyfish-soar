import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Settings from "./pages/Settings";
import Schedule from "./pages/Schedule";
import Lessons from "./pages/Lessons";
import LessonNotes from "./pages/LessonNotes";
import StudentTargets from "./pages/StudentTargets";
import Progress from "./pages/Progress";
import DrivingTests from "./pages/DrivingTests";
import PrePaidHours from "./pages/PrePaidHours";
import PrePaidHoursDetails from "./pages/PrePaidHoursDetails"; // New import
import Resources from "./pages/Resources";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider } from "./components/auth/SessionContextProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="students" element={<Students />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="lessons" element={<Lessons />} />
              <Route path="lesson-notes" element={<LessonNotes />} />
              <Route path="student-targets" element={<StudentTargets />} />
              <Route path="progress" element={<Progress />} />
              <Route path="driving-tests" element={<DrivingTests />} />
              <Route path="pre-paid-hours" element={<PrePaidHours />} />
              <Route path="pre-paid-hours/:packageId" element={<PrePaidHoursDetails />} /> {/* New route */}
              <Route path="resources" element={<Resources />} />
              <Route path="settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;