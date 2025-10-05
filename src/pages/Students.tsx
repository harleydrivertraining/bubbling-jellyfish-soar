"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddStudentForm from "@/components/AddStudentForm";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

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
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground">No students added yet. Click "Add Student" to get started!</p>
          ) : (
            <ul className="space-y-4">
              {students.map((student) => (
                <li key={student.id} className="p-4 border rounded-md shadow-sm bg-background">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><span className="font-semibold">Name:</span> {student.name}</p>
                    <p><span className="font-semibold">Status:</span> {student.status}</p>
                    {student.date_of_birth && (
                      <p><span className="font-semibold">DOB:</span> {format(new Date(student.date_of_birth), "PPP")}</p>
                    )}
                    {student.driving_license_number && (
                      <p><span className="font-semibold">License No:</span> {student.driving_license_number}</p>
                    )}
                    {student.phone_number && (
                      <p><span className="font-semibold">Phone:</span> {student.phone_number}</p>
                    )}
                    {student.full_address && (
                      <p className="md:col-span-2"><span className="font-semibold">Address:</span> {student.full_address}</p>
                    )}
                    {student.notes && (
                      <p className="md:col-span-2"><span className="font-semibold">Notes:</span> {student.notes}</p>
                    )}
                    {student.document_url && (
                      <p className="md:col-span-2">
                        <span className="font-semibold">Document:</span>{" "}
                        <a
                          href={student.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-500 hover:underline"
                        >
                          <FileText className="h-4 w-4 mr-1" /> View Document
                        </a>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;