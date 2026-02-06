"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { subMonths, subYears, isAfter, format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, AlertTriangle, Car, Hand, TrendingUp, Users, CalendarDays, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface DrivingTest {
  id: string;
  student_id: string;
  student_name: string;
  test_date: string;
  passed: boolean;
  driving_faults: number;
  serious_faults: number;
  examiner_action: boolean;
  notes?: string;
}

interface StudentStat {
  studentId: string;
  studentName: string;
  totalTests: number;
  passCount: number;
  avgDrivingFaults: number;
  avgSeriousFaults: number;
}

type StudentFilter = "all" | "passed" | "not-passed";
type StudentSort = "tests-desc" | "tests-asc" | "name-asc";

const TestStatistics: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allTests, setAllTests] = useState<DrivingTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>("last12months");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const [studentSort, setStudentSort] = useState<StudentSort>("tests-desc");

  const fetchTests = useCallback(async () => {
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
      console.error("Error fetching tests for stats:", error);
      showError("Failed to load test statistics.");
      setAllTests([]);
    } else {
      const formatted = (data || []).map(test => ({
        id: test.id,
        student_id: test.student_id,
        student_name: (test.students as { name: string })?.name || "Unknown Student",
        test_date: test.test_date,
        passed: test.passed,
        driving_faults: test.driving_faults,
        serious_faults: test.serious_faults,
        examiner_action: test.examiner_action,
        notes: test.notes,
      }));
      setAllTests(formatted);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchTests();
    }
  }, [isSessionLoading, fetchTests]);

  const filteredTests = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;

    if (timeframe === "last6months") cutoff = subMonths(now, 6);
    else if (timeframe === "last12months") cutoff = subYears(now, 1);

    if (!cutoff) return allTests;

    return allTests.filter(test => isAfter(parseISO(test.test_date), cutoff!));
  }, [allTests, timeframe]);

  const stats = useMemo(() => {
    if (filteredTests.length === 0) return null;

    const total = filteredTests.length;
    const passed = filteredTests.filter(t => t.passed).length;
    const totalDrivingFaults = filteredTests.reduce((sum, t) => sum + t.driving_faults, 0);
    const totalSeriousFaults = filteredTests.reduce((sum, t) => sum + t.serious_faults, 0);
    const examinerActions = filteredTests.filter(t => t.examiner_action).length;

    const studentMap = new Map<string, StudentStat>();
    filteredTests.forEach(t => {
      if (!studentMap.has(t.student_id)) {
        studentMap.set(t.student_id, {
          studentId: t.student_id,
          studentName: t.student_name,
          totalTests: 0,
          passCount: 0,
          avgDrivingFaults: 0,
          avgSeriousFaults: 0,
        });
      }
      const s = studentMap.get(t.student_id)!;
      s.totalTests++;
      if (t.passed) s.passCount++;
      s.avgDrivingFaults += t.driving_faults;
      s.avgSeriousFaults += t.serious_faults;
    });

    let studentStats = Array.from(studentMap.values()).map(s => ({
      ...s,
      avgDrivingFaults: s.avgDrivingFaults / s.totalTests,
      avgSeriousFaults: s.avgSeriousFaults / s.totalTests,
    }));

    if (studentFilter === "passed") {
      studentStats = studentStats.filter(s => s.passCount > 0);
    } else if (studentFilter === "not-passed") {
      studentStats = studentStats.filter(s => s.passCount === 0);
    }

    studentStats.sort((a, b) => {
      if (studentSort === "tests-desc") return b.totalTests - a.totalTests;
      if (studentSort === "tests-asc") return a.totalTests - b.totalTests;
      if (studentSort === "name-asc") return a.studentName.localeCompare(b.studentName);
      return 0;
    });

    return {
      total,
      passRate: (passed / total) * 100,
      avgDrivingFaults: totalDrivingFaults / total,
      avgSeriousFaults: totalSeriousFaults / total,
      examinerActionRate: (examinerActions / total) * 100,
      studentStats,
    };
  }, [filteredTests, studentFilter, studentSort]);

  const selectedStudentTests = useMemo(() => {
    if (!selectedStudentId) return [];
    return allTests.filter(t => t.student_id === selectedStudentId).sort((a, b) => parseISO(b.test_date).getTime() - parseISO(a.test_date).getTime());
  }, [allTests, selectedStudentId]);

  const selectedStudentName = useMemo(() => {
    return selectedStudentTests[0]?.student_name || "Student History";
  }, [selectedStudentTests]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Test Statistics</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="timeframe">Timeframe:</Label>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger id="timeframe" className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last6months">Last 6 Months</SelectItem>
              <SelectItem value="last12months">Last 12 Months</SelectItem>
              <SelectItem value="alltime">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!stats ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No test records found for the selected timeframe.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                  {stats.total}
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn(stats.passRate <= 55 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium opacity-70">Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  {stats.passRate > 55 ? <CheckCircle className="mr-2 h-5 w-5" /> : <XCircle className="mr-2 h-5 w-5" />}
                  {stats.passRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.avgDrivingFaults >= 6 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium opacity-70">Avg. Driving Faults</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <Car className="mr-2 h-5 w-5" />
                  {stats.avgDrivingFaults.toFixed(1)}
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.avgSeriousFaults >= 0.55 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium opacity-70">Avg. Serious Faults</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <ShieldAlert className="mr-2 h-5 w-5" />
                  {stats.avgSeriousFaults.toFixed(1)}
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.examinerActionRate >= 10 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium opacity-70">Ex. Action Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <Hand className="mr-2 h-5 w-5" />
                  {stats.examinerActionRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Performance by Student
                    </CardTitle>
                    <CardDescription>Click a student name to view their full test history.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={studentFilter} onValueChange={(v) => setStudentFilter(v as StudentFilter)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        <SelectItem value="passed">Has Passed</SelectItem>
                        <SelectItem value="not-passed">Not Passed Yet</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={studentSort} onValueChange={(v) => setStudentSort(v as StudentSort)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tests-desc">Most Tests</SelectItem>
                        <SelectItem value="tests-asc">Least Tests</SelectItem>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-center">Tests</TableHead>
                      <TableHead className="text-center">Passes</TableHead>
                      <TableHead className="text-right">Avg. Faults</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.studentStats.map((s) => (
                      <TableRow key={s.studentId}>
                        <TableCell className="font-medium">
                          <button 
                            onClick={() => setSelectedStudentId(s.studentId)}
                            className="text-blue-600 hover:underline text-left"
                          >
                            {s.studentName}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">{s.totalTests}</TableCell>
                        <TableCell className="text-center">
                          <span className={cn(s.passCount > 0 ? "text-green-600 font-semibold" : "text-muted-foreground")}>
                            {s.passCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.avgDrivingFaults.toFixed(1)} / {s.avgSeriousFaults.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {stats.studentStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No students match the selected filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hand className="mr-2 h-5 w-5" />
                  Safety Metrics
                </CardTitle>
                <CardDescription>Analysis of examiner interventions and serious faults.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Examiner Action Rate</span>
                    <span className="font-semibold">{stats.examinerActionRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all",
                        stats.examinerActionRate >= 10 ? "bg-orange-500" : "bg-green-500"
                      )} 
                      style={{ width: `${Math.min(100, stats.examinerActionRate)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Percentage of tests where the examiner had to take physical action.</p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2">Quick Insights</h4>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li>• Most students pass within {stats.total > 0 ? (stats.total / stats.studentStats.length).toFixed(1) : 0} attempts on average.</li>
                    <li>• Serious faults are {stats.avgSeriousFaults < 0.55 ? "relatively low" : "a common area for improvement"}.</li>
                    <li>• Your current pass rate is {stats.passRate > 55 ? "above" : "below"} your target benchmark.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedStudentName} - Test History
            </DialogTitle>
            <DialogDescription>
              Chronological list of all driving test attempts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {selectedStudentTests.map((test) => (
              <Card key={test.id} className="overflow-hidden">
                <div className={cn(
                  "h-1 w-full",
                  test.passed ? "bg-green-500" : "bg-destructive"
                )} />
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(test.test_date), "PPP")}
                      </div>
                      <div className="flex items-center gap-2">
                        {test.passed ? (
                          <Badge className="bg-green-500 hover:bg-green-600">Passed</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                        {test.examiner_action && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Examiner Action
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span>Driving Faults: <strong>{test.driving_faults}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span>Serious Faults: <strong>{test.serious_faults}</strong></span>
                      </div>
                    </div>
                  </div>
                  {test.notes && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground italic">
                      "{test.notes}"
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestStatistics;