"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Phone, CalendarDays, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddStudentForm from "@/components/AddStudentForm";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
  date_of_birth?: string; // ISO string
  driving_license_number?: string;
  phone_number?: string;
  full_address?: string;
  notes?: string;
  document_url?: string;
}

const Students: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStudents = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, status, date_of_birth, driving_license_number, phone_number, full_address, notes, document_url")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching students:", error);
      showError("Failed to load students: " + error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [user, isSessionLoading]);

  const handleStudentAdded = () => {
    fetchStudents(); // Refresh the list after a new student is added
    setIsDialogOpen(false); // Close the dialog
  };

  const filteredStudents = useMemo(() => {
    let currentStudents = [...students];

    // Filter logic
    if (searchTerm) {
      currentStudents = currentStudents.filter((student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return currentStudents;
  }, [students, searchTerm]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Students</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <AddStudentForm onStudentAdded={handleStudentAdded} onClose={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search students by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStudents.length === 0 && students.length > 0 && (
          <p className="text-muted-foreground col-span-full">No students match your search.</p>
        )}
        {students.length === 0 && (
          <p className="text-muted-foreground col-span-full">No students added yet. Click "Add Student" to get started!</p>
        )}
        {filteredStudents.map((student) => (
          <Card key={student.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{student.name}</CardTitle>
              <Badge variant={
                student.status === "Beginner" ? "secondary" :
                student.status === "Intermediate" ? "default" :
                "outline"
              }>
                {student.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-sm">
              {student.date_of_birth && (
                <div className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span>DOB: {format(new Date(student.date_of_birth), "PPP")}</span>
                </div>
              )}
              {student.phone_number && (
                <div className="flex items-center text-muted-foreground">
                  <Phone className="mr-2 h-4 w-4" />
                  <span>{student.phone_number}</span>
                </div>
              )}
              {student.driving_license_number && (
                <div className="flex items-center text-muted-foreground">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span>License: {student.driving_license_number}</span>
                </div>
              )}
              {student.full_address && (
                <CardDescription className="text-muted-foreground">
                  {student.full_address}
                </CardDescription>
              )}
              {student.notes && (
                <CardDescription className="text-muted-foreground italic">
                  Notes: {student.notes}
                </CardDescription>
              )}
              {student.document_url && (
                <a
                  href={student.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-500 hover:underline mt-2"
                >
                  <FileText className="h-4 w-4 mr-1" /> View Document
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Students;