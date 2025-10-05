"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddStudentForm from "@/components/AddStudentForm";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Import Badge component

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

type SortKey = keyof Student;
type SortDirection = "asc" | "desc" | null;

const Students: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "name",
    direction: "asc",
  });

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

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null; // Cycle to no sort
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedStudents = useMemo(() => {
    let sortableStudents = [...students];

    // Filter logic
    if (searchTerm) {
      sortableStudents = sortableStudents.filter((student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort logic
    if (sortConfig.direction !== null) {
      sortableStudents.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === "asc" ? -1 : 1;

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        // Fallback for other types, though name/status are strings
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sortableStudents;
  }, [students, searchTerm, sortConfig]);

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

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedStudents.length === 0 && students.length > 0 && (
            <p className="text-muted-foreground">No students match your search.</p>
          )}
          {students.length === 0 && (
            <p className="text-muted-foreground">No students added yet. Click "Add Student" to get started!</p>
          )}
          {filteredAndSortedStudents.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("name")} className="p-0 h-auto">
                        Name
                        {sortConfig.key === "name" && sortConfig.direction === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                        {sortConfig.key === "name" && sortConfig.direction === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                        {sortConfig.key !== "name" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort("status")} className="p-0 h-auto">
                        Status
                        {sortConfig.key === "status" && sortConfig.direction === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                        {sortConfig.key === "status" && sortConfig.direction === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                        {sortConfig.key !== "status" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                    </TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>License No.</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          student.status === "Beginner" ? "secondary" :
                          student.status === "Intermediate" ? "default" :
                          "outline"
                        }>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.date_of_birth ? format(new Date(student.date_of_birth), "PPP") : "N/A"}
                      </TableCell>
                      <TableCell>{student.driving_license_number || "N/A"}</TableCell>
                      <TableCell>{student.phone_number || "N/A"}</TableCell>
                      <TableCell>{student.full_address || "N/A"}</TableCell>
                      <TableCell>{student.notes || "N/A"}</TableCell>
                      <TableCell>
                        {student.document_url ? (
                          <a
                            href={student.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-500 hover:underline"
                          >
                            <FileText className="h-4 w-4 mr-1" /> View
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;