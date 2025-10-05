"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, BookOpen, Target, User, MessageSquareText } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom"; // Assuming a future detail page

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
}

interface LatestBookingInfo {
  id: string;
  start_time: string;
  description?: string;
  targets_for_next_session?: string;
}

interface StudentProgressCardProps {
  student: Student;
  latestBookingInfo?: LatestBookingInfo;
}

// Helper function to check if a string has meaningful content
const hasContent = (text: string | null | undefined) => {
  return text != null && text.trim().length > 0;
};

const StudentProgressCard: React.FC<StudentProgressCardProps> = ({ student, latestBookingInfo }) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <User className="mr-2 h-5 w-5 text-muted-foreground" />
          {student.name}
        </CardTitle>
        <Badge variant={
          student.status === "Beginner" ? "secondary" :
          student.status === "Intermediate" ? "default" :
          "outline"
        }>
          {student.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        {latestBookingInfo ? (
          <>
            <div className="flex items-center text-muted-foreground">
              <CalendarDays className="mr-2 h-4 w-4" />
              <span>Last Lesson: {format(new Date(latestBookingInfo.start_time), "PPP")}</span>
            </div>
            {hasContent(latestBookingInfo.description) && (
              <div>
                <h3 className="font-semibold mb-1 flex items-center">
                  <MessageSquareText className="mr-2 h-4 w-4 text-muted-foreground" />
                  Last Lesson Notes:
                </h3>
                <p className="text-muted-foreground line-clamp-2">{latestBookingInfo.description}</p>
              </div>
            )}
            {hasContent(latestBookingInfo.targets_for_next_session) && (
              <div>
                <h3 className="font-semibold mb-1 flex items-center">
                  <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                  Targets for Next Session:
                </h3>
                <p className="text-muted-foreground line-clamp-2">{latestBookingInfo.targets_for_next_session}</p>
              </div>
            )}
            {!hasContent(latestBookingInfo.description) && !hasContent(latestBookingInfo.targets_for_next_session) && (
              <p className="text-muted-foreground italic">No specific notes or targets from last lesson.</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground italic">No completed lessons recorded yet.</p>
        )}
        {/* Future: Link to a detailed student progress page */}
        {/* <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link to={`/students/${student.id}/progress`}>
            View Full Progress
          </Link>
        </Button> */}
      </CardContent>
    </Card>
  );
};

export default StudentProgressCard;