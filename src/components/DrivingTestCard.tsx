"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CalendarDays, User, CheckCircle, XCircle, Car, AlertTriangle, Hand, MessageSquareText } from "lucide-react"; // Added MessageSquareText icon
import { cn } from "@/lib/utils";

interface DrivingTest {
  id: string;
  student_name: string; // Joined from students table
  test_date: string; // ISO date string
  passed: boolean;
  driving_faults: number;
  serious_faults: number;
  examiner_action: boolean;
  notes?: string; // New notes field
}

interface DrivingTestCardProps {
  test: DrivingTest;
  onEdit: (testId: string) => void;
}

const DrivingTestCard: React.FC<DrivingTestCardProps> = ({ test, onEdit }) => {
  const hasContent = (text: string | null | undefined) => text != null && text.trim().length > 0;

  return (
    <Card className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onEdit(test.id)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <User className="mr-2 h-5 w-5 text-muted-foreground" />
          {test.student_name}
        </CardTitle>
        <CardDescription className="flex items-center text-muted-foreground text-sm">
          <CalendarDays className="mr-2 h-4 w-4" />
          <span>Test Date: {format(new Date(test.test_date), "PPP")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        <div className="flex items-center">
          {test.passed ? (
            <Badge className="bg-green-500 hover:bg-green-500/80 text-white">
              <CheckCircle className="mr-1 h-3 w-3" /> Passed
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" /> Failed
            </Badge>
          )}
        </div>
        <div className="flex items-center text-muted-foreground">
          <Car className="mr-2 h-4 w-4" />
          <span>Driving Faults: {test.driving_faults}</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <AlertTriangle className="mr-2 h-4 w-4" />
          <span>Serious Faults: {test.serious_faults}</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <Hand className="mr-2 h-4 w-4" />
          <span>Examiner Action: {test.examiner_action ? "Yes" : "No"}</span>
        </div>
        {hasContent(test.notes) && (
          <div>
            <h3 className="font-semibold mb-1 flex items-center">
              <MessageSquareText className="mr-2 h-4 w-4 text-muted-foreground" />
              Notes:
            </h3>
            <p className="text-muted-foreground line-clamp-2">{test.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DrivingTestCard;