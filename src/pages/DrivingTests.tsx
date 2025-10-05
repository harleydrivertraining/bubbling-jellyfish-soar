"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
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
import AddDrivingTestForm from "@/components/AddDrivingTestForm";
import DrivingTestCard from "@/components/DrivingTestCard";
import EditDrivingTestForm from "@/components/EditDrivingTestForm";
import { subYears, isAfter } from "date-fns"; // Import subYears and isAfter

interface DrivingTest {
  id: string;
  student_id: string;
  student_name: string; // Joined from students table
  test_date: string; // ISO date string
  passed: boolean;
  driving_faults: number;
  serious_faults: number;
  examiner_action: boolean;
}

interface Student {
  id: string;
  name: string;
}

interface DrivingTestStats {
  totalTests: number; // Added totalTests
  passRate: number;
  avgDrivingFaults: number;
  avgSeriousFaults: number;
  examinerActionPercentage: number;
}

const DrivingTests: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allDrivingTests, setAllDrivingTests] = useState<DrivingTest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddTestDialogOpen, setIsAddTestDialogOpen] = useState(false);
  const [isEditTestDialogOpen, setIsEditTestDialogOpen] = useState(false);
  const [selectedTestForEdit, setSelectedTestForEdit] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [selectedOutcome, setSelectedOutcome] = useState<string>("all"); // "all", "passed", "failed"
  const [stats, setStats] = useState<DrivingTestStats | null>(null); // New state for statistics

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("students")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching students:", error);
      showError("Failed to load students for filter: " + error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
  }, [user]);

  const fetchDrivingTests = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("driving_tests")
      .select("*, students(name)")
      .eq("user_id", user.id)
      .order("test_date", { ascending: false });

    if (error) {
      console.error("Error fetching driving tests:", error);
      showError("Failed to load driving test records: " + error.message);
      setAllDrivingTests([]);
      setStats(null);
    } else {
      const formattedTests: DrivingTest[] = (data || []).map(test => ({
        id: test.id,
        student_id: test.student_id,
        student_name: (test.students as { name: string })?.name || "Unknown Student",
        test_date: test.test_date,
        passed: test.passed,
        driving_faults: test.driving_faults,
        serious_faults: test.serious_faults,
        examiner_action: test.examiner_action,
      }));
      setAllDrivingTests(formattedTests);
      
      // Calculate statistics for the past 12 months
      const twelveMonthsAgo = subYears(new Date(), 1);
      const recentTests = formattedTests.filter(test => isAfter(new Date(test.test_date), twelveMonthsAgo));

      if (recentTests.length > 0) {
        const totalTests = recentTests.length;
        const passedTests = recentTests.filter(test => test.passed).length;
        const totalDrivingFaults = recentTests.reduce((sum, test) => sum + test.driving_faults, 0);
        const totalSeriousFaults = recentTests.reduce((sum, test) => sum + test.serious_faults, 0);
        const examinerActions = recentTests.filter(test => test.examiner_action).length;

        setStats({
          totalTests: totalTests, // Set totalTests here
          passRate: (passedTests / totalTests) * 100,
          avgDrivingFaults: totalDrivingFaults / totalTests,
          avgSeriousFaults: totalSeriousFaults / totalTests,
          examinerActionPercentage: (examinerActions / totalTests) * 100,
        });
      } else {
        setStats({
          totalTests: 0, // Set to 0 if no recent tests
          passRate: 0,
          avgDrivingFaults: 0,
          avgSeriousFaults: 0,
          examinerActionPercentage: 0,
        });
      }
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchStudents();
      fetchDrivingTests();
    }
  }, [isSessionLoading, fetchStudents, fetchDrivingTests]);

  const handleTestAdded = () => {
    fetchDrivingTests();
    setIsAddTestDialogOpen(false);
  };

  const handleCloseAddTestDialog = () => {
    setIsAddTestDialogOpen(false);
  };

  const handleEditTestClick = (testId: string) => {
    setSelectedTestForEdit(testId);
    setIsEditTestDialogOpen(true);
  };

  const handleTestUpdated = () => {
    fetchDrivingTests();
    setIsEditTestDialogOpen(false);
    setSelectedTestForEdit(null);
  };

  const handleTestDeleted = () => {
    fetchDrivingTests();
    setIsEditTestDialogOpen(false);
    setSelectedTestForEdit(null);
  };

  const handleCloseEditTestDialog = () => {
    setIsEditTestDialogOpen(false);
    setSelectedTestForEdit(null);
  };

  const filteredDrivingTests = useMemo(() => {
    let currentTests = [...allDrivingTests];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentTests = currentTests.filter(
        (test) => test.student_name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (selectedStudentId !== "all") {
      currentTests = currentTests.filter(
        (test) => test.student_id === selectedStudentId
      );
    }

    if (selectedOutcome !== "all") {
      currentTests = currentTests.filter(
        (test) => (selectedOutcome === "passed" ? test.passed : !test.passed)
      );
    }

    return currentTests;
  }, [allDrivingTests, searchTerm, selectedStudentId, selectedOutcome]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-6"> {/* Updated grid-cols to 5 */}
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        </div>
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Driving Tests</h1>
        <Dialog open={isAddTestDialogOpen} onOpenChange={setIsAddTestDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Test Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Driving Test Record</DialogTitle>
            </DialogHeader>
            <AddDrivingTestForm onTestAdded={handleTestAdded} onClose={handleCloseAddTestDialog} />
          </DialogContent>
        </Dialog>
      </div>

      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-6"> {/* Updated grid-cols to 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tests Taken (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalTests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pass Rate (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.passRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avg. Driving Faults</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.avgDrivingFaults.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avg. Serious Faults</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.avgSeriousFaults.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Examiner Action Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.examinerActionPercentage.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Input
          placeholder="Search by student name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="student-filter">Student:</Label>
          <Select onValueChange={setSelectedStudentId} defaultValue={selectedStudentId}>
            <SelectTrigger id="student-filter" className="w-[180px]">
              <SelectValue placeholder="Filter by student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="outcome-filter">Outcome:</Label>
          <Select onValueChange={setSelectedOutcome} defaultValue={selectedOutcome}>
            <SelectTrigger id="outcome-filter" className="w-[180px]">
              <SelectValue placeholder="Filter by outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredDrivingTests.length === 0 && allDrivingTests.length > 0 && (
        <p className="text-muted-foreground col-span-full">No driving test records match your search or filter criteria.</p>
      )}
      {allDrivingTests.length === 0 ? (
        <p className="text-muted-foreground">No driving test records added yet. Click "Add Test Record" to get started!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDrivingTests.map((test) => (
            <DrivingTestCard key={test.id} test={test} onEdit={handleEditTestClick} />
          ))}
        </div>
      )}

      <Dialog open={isEditTestDialogOpen} onOpenChange={handleCloseEditTestDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driving Test Record</DialogTitle>
          </DialogHeader>
          {selectedTestForEdit && (
            <EditDrivingTestForm
              testId={selectedTestForEdit}
              onTestUpdated={handleTestUpdated}
              onTestDeleted={handleTestDeleted}
              onClose={handleCloseEditTestDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrivingTests;