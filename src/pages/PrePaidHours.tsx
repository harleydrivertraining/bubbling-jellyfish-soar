"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Hourglass, PoundSterling, FileText, CalendarDays } from "lucide-react"; // Changed DollarSign to PoundSterling
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import AddPrePaidHoursForm from "@/components/AddPrePaidHoursForm"; // Import the new form
import { format } from "date-fns";

interface StudentPrePaidHours {
  student_id: string;
  student_name: string;
  total_remaining_hours: number;
  packages: Array<{
    id: string;
    package_hours: number;
    remaining_hours: number;
    amount_paid?: number;
    purchase_date: string;
    notes?: string;
  }>;
}

const PrePaidHours: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [studentPrePaidHours, setStudentPrePaidHours] = useState<StudentPrePaidHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPrePaidHours = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch all pre_paid_hours for the user, including student details
    const { data: hoursData, error: hoursError } = await supabase
      .from("pre_paid_hours")
      .select("id, student_id, package_hours, remaining_hours, amount_paid, purchase_date, notes, students(id, name)")
      .eq("user_id", user.id)
      .order("purchase_date", { ascending: false });

    if (hoursError) {
      console.error("Error fetching pre-paid hours:", hoursError);
      showError("Failed to load pre-paid hours: " + hoursError.message);
      setIsLoading(false);
      return;
    }

    const studentPrePaidHoursMap = new Map<string, StudentPrePaidHours>();

    hoursData.forEach(hourPackage => {
      const studentId = hourPackage.student_id;
      // Ensure student data exists and has a name, fallback to "Unknown Student"
      const studentName = hourPackage.students?.name || "Unknown Student"; 

      if (!studentPrePaidHoursMap.has(studentId)) {
        studentPrePaidHoursMap.set(studentId, {
          student_id: studentId,
          student_name: studentName,
          total_remaining_hours: 0,
          packages: [],
        });
      }

      const studentEntry = studentPrePaidHoursMap.get(studentId)!;
      studentEntry.total_remaining_hours += hourPackage.remaining_hours;
      studentEntry.packages.push({
        id: hourPackage.id,
        package_hours: hourPackage.package_hours,
        remaining_hours: hourPackage.remaining_hours,
        amount_paid: hourPackage.amount_paid,
        purchase_date: hourPackage.purchase_date,
        notes: hourPackage.notes,
      });
    });

    setStudentPrePaidHours(Array.from(studentPrePaidHoursMap.values()));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchPrePaidHours();
    }
  }, [isSessionLoading, fetchPrePaidHours]);

  const handleHoursAdded = () => {
    fetchPrePaidHours(); // Refresh the list after new hours are added
    setIsDialogOpen(false); // Close the dialog
  };

  const filteredStudents = useMemo(() => {
    let currentStudents = [...studentPrePaidHours];

    if (searchTerm) {
      currentStudents = currentStudents.filter((student) =>
        student.student_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return currentStudents;
  }, [studentPrePaidHours, searchTerm]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pre-Paid Hours</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Hours
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Pre-Paid Hours</DialogTitle>
            </DialogHeader>
            <AddPrePaidHoursForm onHoursAdded={handleHoursAdded} onClose={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search students by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {filteredStudents.length === 0 && studentPrePaidHours.length > 0 && (
        <p className="text-muted-foreground col-span-full">No students match your search.</p>
      )}
      {studentPrePaidHours.length === 0 ? (
        <p className="text-muted-foreground">No pre-paid hours recorded yet. Click "Add Hours" to get started!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((student) => (
            <Card key={student.student_id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">{student.student_name}</CardTitle>
                <div className="flex items-center text-primary font-bold text-xl">
                  <Hourglass className="mr-2 h-5 w-5" />
                  <span>{student.total_remaining_hours.toFixed(1)} hrs</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                <h3 className="font-semibold text-muted-foreground">Packages:</h3>
                {student.packages.length > 0 ? (
                  <ul className="space-y-2">
                    {student.packages.map((pkg) => (
                      <li key={pkg.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{pkg.package_hours} hrs purchased</span>
                          <span className="text-sm text-muted-foreground">
                            {pkg.remaining_hours.toFixed(1)} hrs remaining
                          </span>
                        </div>
                        {pkg.amount_paid !== null && (
                          <div className="flex items-center text-muted-foreground mt-1">
                            <PoundSterling className="mr-1 h-3 w-3" /> {/* Changed DollarSign to PoundSterling */}
                            <span>Paid: £{pkg.amount_paid.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center text-muted-foreground mt-1">
                          <CalendarDays className="mr-1 h-3 w-3" />
                          <span>Purchased: {format(new Date(pkg.purchase_date), "PPP")}</span>
                        </div>
                        {pkg.notes && (
                          <CardDescription className="text-muted-foreground italic mt-1">
                            Notes: {pkg.notes}
                          </CardDescription>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground italic">No packages for this student.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrePaidHours;