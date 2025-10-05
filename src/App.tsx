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
import Lessons from "./pages/Lessons"; // Import new page
import LessonNotes from "./pages/LessonNotes"; // Import new page
import StudentTargets from "./pages/StudentTargets"; // Import new page
import Progress from "./pages/Progress"; // Import new page
import DrivingTests from "./pages/DrivingTests"; // Import new page
import PrePaidHours from "./pages/PrePaidHours"; // Import new page
import Resources from "./pages/Resources"; // Import new page
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
              <Route path="lessons" element={<Lessons />} /> {/* New route */}
              <Route path="lesson-notes" element={<LessonNotes />} /> {/* New route */}
              <Route path="student-targets" element={<StudentTargets />} /> {/* New route */}
              <Route path="progress" element={<Progress />} /> {/* New route */}
              <Route path="driving-tests" element={<DrivingTests />} /> {/* New route */}
              <Route path="pre-paid-hours" element={<PrePaidHours />} /> {/* New route */}
              <Route path="resources" element={<Resources />} /> {/* New route */}
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