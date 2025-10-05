"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, User, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ProgressEntryCard from "@/components/ProgressEntryCard";
import AddProgressEntryForm from "@/components/AddProgressEntryForm";
import EditProgressEntryForm from "@/components/EditProgressEntryForm"; // New import
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Student {
  id: string;
  name: string;
  status: "Beginner" | "Intermediate" | "Advanced";
}

interface ProgressEntry {
  id: string;
  topic_name: string; // Joined from progress_topics
  rating: number;
  comment?: string;
  targets?: string;
  entry_date: string; // ISO string
}

interface StudentWithProgress extends Student {
  progressEntries: ProgressEntry[];
}

const Progress: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allStudentsWithProgress, setAllStudentsWithProgress] = useState<StudentWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [selectedStudentForEntry, setSelectedStudentForEntry] = useState<Student | null>(null);

  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false); // New state for edit dialog
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<string | null>(null); // New state for entry being edited

  const fetchStudentsWithProgress = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("id, name, status")
      .eq("user_id", user.id);

    if (studentsError) {
      console.error("Error fetching students for progress:", studentsError);
      showError("Failed to load students: " + studentsError.message);
      setAllStudentsWithProgress([]);
      setIsLoading(false);
      return;
    }

    const studentsWithEntries: StudentWithProgress[] = [];

    for (const student of studentsData || []) {
      const { data: entriesData, error: entriesError } = await supabase
        .from("student_progress_entries")
        .select("*, progress_topics(name)")
        .eq("student_id", student.id)
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false });

      if (entriesError) {
        console.error(`Error fetching progress entries for student ${student.name}:`, entriesError);
        showError(`Failed to load progress entries for ${student.name}: ` + entriesError.message);
        studentsWithEntries.push({ ...student, progressEntries: [] });
      } else {
        const formattedEntries: ProgressEntry[] = (entriesData || []).map(entry => ({
          id: entry.id,
          topic_name: (entry.progress_topics as { name: string })?.name || "Unknown Topic",
          rating: entry.rating,
          comment: entry.comment,
          targets: entry.targets,
          entry_date: entry.entry_date,
        }));
        studentsWithEntries.push({ ...student, progressEntries: formattedEntries });
      }
    }

    setAllStudentsWithProgress(studentsWithEntries);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudentsWithProgress();
    }
  }, [isSessionLoading, fetchStudentsWithProgress]);

  const handleAddEntryClick = (student: Student) => {
    setSelectedStudentForEntry(student);
    setIsAddEntryDialogOpen(true);
  };

  const handleEntryAdded = () => {
    fetchStudentsWithProgress(); // Refresh all data
    setIsAddEntryDialogOpen(false);
    setSelectedStudentForEntry(null);
  };

  const handleCloseAddEntryDialog = () => {
    setIsAddEntryDialogOpen(false);
    setSelectedStudentForEntry(null);
  };

  const handleEditEntryClick = (entryId: string) => {
    setSelectedEntryForEdit(entryId);
    setIsEditEntryDialogOpen(true);
  };

  const handleEntryUpdated = () => {
    fetchStudentsWithProgress(); // Refresh all data
    setIsEditEntryDialogOpen(false);
    setSelectedEntryForEdit(null);
  };

  const handleEntryDeleted = () => {
    fetchStudentsWithProgress(); // Refresh all data
    setIsEditEntryDialogOpen(false);
    setSelectedEntryForEdit(null);
  };

  const handleCloseEditEntryDialog = () => {
    setIsEditEntryDialogOpen(false);
    setSelectedEntryForEdit(null);
  };

  const filteredStudentsProgress = useMemo(() => {
    let currentStudents = [...allStudentsWithProgress];

    // Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentStudents = currentStudents.filter(
        (student) =>
          student.name.toLowerCase().includes(lowerCaseSearchTerm) ||
          student.progressEntries.some(
            (entry) =>
              entry.topic_name.toLowerCase().includes(lowerCaseSearchTerm) ||
              (entry.comment && entry.comment.toLowerCase().includes(lowerCaseSearchTerm)) ||
              (entry.targets && entry.targets.toLowerCase().includes(lowerCaseSearchTerm))
          )
      );
    }

    // Filter by status
    if (selectedStatus !== "all") {
      currentStudents = currentStudents.filter((student) =>
        student.status === selectedStatus
      );
    }

    return currentStudents;
  }, [allStudentsWithProgress, searchTerm, selectedStatus]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Progress Tracker</h1>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Input
          placeholder="Search students, topics, comments, or targets..."
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
      </div>

      {filteredStudentsProgress.length === 0 && allStudentsWithProgress.length > 0 && (
        <p className="text-muted-foreground col-span-full">No students match your search or filter criteria.</p>
      )}
      {allStudentsWithProgress.length === 0 ? (
        <p className="text-muted-foreground">No students added yet. Go to the Students page to add one!</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredStudentsProgress.map((student) => (
            <Card key={student.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold flex items-center">
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
              <CardContent className="flex-1 space-y-4">
                <Button onClick={() => handleAddEntryClick(student)} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Progress Entry
                </Button>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="progress-history">
                    <AccordionTrigger className="text-lg font-semibold flex items-center">
                      <GraduationCap className="mr-2 h-5 w-5 text-muted-foreground" />
                      Progress History
                    </AccordionTrigger>
                    <AccordionContent>
                      {student.progressEntries.length === 0 ? (
                        <p className="text-muted-foreground italic mt-2">No progress entries recorded yet for this student.</p>
                      ) : (
                        <div className="space-y-3 mt-2">
                          {student.progressEntries.map((entry) => (
                            <ProgressEntryCard key={entry.id} entry={entry} onEdit={handleEditEntryClick} />
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddEntryDialogOpen} onOpenChange={handleCloseAddEntryDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Progress Entry for {selectedStudentForEntry?.name}</DialogTitle>
          </DialogHeader>
          {selectedStudentForEntry && (
            <AddProgressEntryForm
              studentId={selectedStudentForEntry.id}
              onEntryAdded={handleEntryAdded}
              onClose={handleCloseAddEntryDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditEntryDialogOpen} onOpenChange={handleCloseEditEntryDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Progress Entry</DialogTitle>
          </DialogHeader>
          {selectedEntryForEdit && (
            <EditProgressEntryForm
              entryId={selectedEntryForEdit}
              onEntryUpdated={handleEntryUpdated}
              onEntryDeleted={handleEntryDeleted}
              onClose={handleCloseEditEntryDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Progress;