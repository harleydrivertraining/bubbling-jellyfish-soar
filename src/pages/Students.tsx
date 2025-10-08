"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Phone, CalendarDays, GraduationCap, Edit, Trash2, UserX } from "lucide-react"; // Added UserX icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddStudentForm from "@/components/AddStudentForm";
import EditStudentForm from "@/components/EditStudentForm";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils"; // Import cn utility

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
  is_past_student: boolean; // New field
}

const Students: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showPastStudents, setShowPastStudents] = useState<string>("current"); // "current", "past", "all"

  const fetchStudents = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, status, date_of_birth, driving_license_number, phone_number, full_address, notes, document_url, is_past_student") // Fetch new field
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching students:", error);
      showError("Failed to load students: " + error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
    }
  }, [user, isSessionLoading, fetchStudents]);

  const handleStudentAdded = () => {
    fetchStudents();
    setIsAddDialogOpen(false);
  };

  const handleEditStudentClick = (studentId: string) => {
    setSelectedStudentForEdit(studentId);
    setIsEditDialogOpen(true);
  };

  const handleStudentUpdated = () => {
    fetchStudents();
    setIsEditDialogOpen(false);
    setSelectedStudentForEdit(null);
  };

  const handleStudentDeleted = () => {
    fetchStudents();
    setIsEditDialogOpen(false);
    setSelectedStudentForEdit(null);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedStudentForEdit(null);
  };

  const filteredStudents = useMemo(() => {
    let currentStudents = [...students];

    // Filter by search term
    if (searchTerm) {
      currentStudents = currentStudents.filter((student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.driving_license_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.full_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (selectedStatus !== "all") {
      currentStudents = currentStudents.filter((student) =>
        student.status === selectedStatus
      );
    }

    // Filter by past student status
    if (showPastStudents === "current") {
      currentStudents = currentStudents.filter((student) => !student.is_past_student);
    } else if (showPastStudents === "past") {
      currentStudents = currentStudents.filter((student) => student.is_past_student);
    }

    return currentStudents;
  }, [students, searchTerm, selectedStatus, showPastStudents]);

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
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <AddStudentForm onStudentAdded={handleStudentAdded} onClose={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Input
          placeholder="Search students by name, license, phone, address, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter">Status:</Label>
          <Select onValueChange={setSelectedStatus} defaultValue={selectedStatus}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="past-student-filter">View:</Label>
          <Select onValueChange={setShowPastStudents} defaultValue={showPastStudents}>
            <SelectTrigger id="past-student-filter" className="w-[180px]">
              <SelectValue placeholder="View students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Students</SelectItem>
              <SelectItem value="past">Past Students</SelectItem>
              <SelectItem value="all">All Students</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredStudents.length === 0 && students.length > 0 && (
        <p className="text-muted-foreground col-span-full">No students match your search or filter criteria.</p>
      )}
      {students.length === 0 ? (
        <p className="text-muted-foreground col-span-full">No students added yet. Click "Add Student" to get started!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((student) => (
            <Card key={student.id} className={cn("flex flex-col", student.is_past_student && "opacity-70 border-dashed")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">{student.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {student.is_past_student && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      <UserX className="mr-1 h-3 w-3" /> Past Student
                    </Badge>
                  )}
                  <Badge variant={
                    student.status === "Beginner" ? "secondary" :
                    student.status === "Intermediate" ? "default" :
                    "outline"
                  }>
                    {student.status}
                  </Badge>
                </div>
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
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditStudentClick(student.id)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {selectedStudentForEdit && (
            <EditStudentForm
              studentId={selectedStudentForEdit}
              onStudentUpdated={handleStudentUpdated}
              onStudentDeleted={handleStudentDeleted}
              onClose={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;