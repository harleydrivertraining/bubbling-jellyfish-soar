"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, isBefore, parseISO, startOfYear, setMonth, setDate, subYears, addYears } from "date-fns";
import { 
  PoundSterling, 
  TrendingUp, 
  Clock, 
  CalendarDays, 
  Wallet,
  Receipt,
  User,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Transaction {
  id: string;
  type: 'lesson' | 'package';
  date: string;
  amount: number;
  description: string;
  student_name: string;
  status: string;
}

// Helper to get the start and end of a UK tax year for a given "start year"
const getTaxYearRange = (startYear: number) => {
  const start = new Date(startYear, 3, 6); // April 6th
  const end = new Date(startYear + 1, 3, 5, 23, 59, 59); // April 5th next year
  return { start, end };
};

// Helper to determine which tax year a date falls into
const getTaxYearStartForDate = (date: Date) => {
  const year = date.getFullYear();
  const taxYearStartThisYear = new Date(year, 3, 6);
  return isBefore(date, taxYearStartThisYear) ? year - 1 : year;
};

const Accounts: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [unpaidLessons, setUnpaidLessons] = useState<any[]>([]);
  
  // Default to current tax year
  const [selectedTaxYearStart, setSelectedTaxYearStart] = useState<number>(getTaxYearStartForDate(new Date()));

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", user.id)
        .single();
      
      const rate = profile?.hourly_rate || 0;
      setHourlyRate(rate);

      const [packagesRes, lessonsRes, creditTxRes] = await Promise.all([
        supabase.from("pre_paid_hours").select("id, amount_paid, purchase_date, students(name)").eq("user_id", user.id),
        supabase.from("bookings").select("id, title, start_time, end_time, is_paid, status, students(name)").eq("user_id", user.id).eq("status", "completed").order("start_time", { ascending: false }),
        supabase.from("pre_paid_hours_transactions").select("booking_id").eq("user_id", user.id)
      ]);

      const creditPaidIds = new Set(creditTxRes.data?.map(t => t.booking_id) || []);
      const allTx: Transaction[] = [];
      const unpaid: any[] = [];

      packagesRes.data?.forEach(pkg => {
        if (pkg.amount_paid) {
          allTx.push({
            id: pkg.id,
            type: 'package',
            date: pkg.purchase_date,
            amount: pkg.amount_paid,
            description: "Pre-paid Hours Package",
            student_name: (pkg.students as any)?.name || "Unknown",
            status: 'paid'
          });
        }
      });

      lessonsRes.data?.forEach(lesson => {
        const isCredit = creditPaidIds.has(lesson.id);
        const duration = (new Date(lesson.end_time).getTime() - new Date(lesson.start_time).getTime()) / 3600000;
        const value = duration * rate;

        if (lesson.is_paid && !isCredit) {
          allTx.push({
            id: lesson.id,
            type: 'lesson',
            date: lesson.start_time,
            amount: value,
            description: "Individual Lesson Payment",
            student_name: (lesson.students as any)?.name || "Unknown",
            status: 'paid'
          });
        } else if (!lesson.is_paid && !isCredit) {
          unpaid.push({ ...lesson, value });
        }
      });

      setAllTransactions(allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setUnpaidLessons(unpaid);

    } catch (error: any) {
      console.error("Error fetching accounts data:", error);
      showError("Failed to load financial data.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const taxYearRange = useMemo(() => getTaxYearRange(selectedTaxYearStart), [selectedTaxYearStart]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const date = new Date(tx.date);
      return date >= taxYearRange.start && date <= taxYearRange.end;
    });
  }, [allTransactions, taxYearRange]);

  const stats = useMemo(() => {
    const totalIncome = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Calculate "This Month" within the context of the tax year or just absolute month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthIncome = filteredTransactions
      .filter(tx => new Date(tx.date) >= monthStart)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const pendingIncome = unpaidLessons.reduce((sum, l) => sum + l.value, 0);

    return { totalIncome, monthIncome, pendingIncome };
  }, [filteredTransactions, unpaidLessons]);

  const availableYears = useMemo(() => {
    const currentYear = getTaxYearStartForDate(new Date());
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, []);

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Accounts</h1>
          <p className="text-muted-foreground font-medium">Financial Year: 6th April {selectedTaxYearStart} — 5th April {selectedTaxYearStart + 1}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-primary/5 border border-primary/10 px-4 py-2 rounded-lg hidden md:block">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Current Rate</p>
            <p className="text-lg font-black text-primary">£{hourlyRate.toFixed(2)}/hr</p>
          </div>
          
          <Select 
            value={selectedTaxYearStart.toString()} 
            onValueChange={(val) => setSelectedTaxYearStart(parseInt(val))}
          >
            <SelectTrigger className="w-[200px] font-bold">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select Tax Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()} className="font-medium">
                  Tax Year {year}/{year + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-green-600" /> Year Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">£{stats.totalIncome.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Earnings for selected tax year</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-3 w-3 text-blue-600" /> This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">£{stats.monthIncome.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Earnings in current calendar month</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", stats.pendingIncome > 0 ? "border-l-orange-500 bg-orange-50/30" : "border-l-muted")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 text-orange-600" /> Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-black", stats.pendingIncome > 0 ? "text-orange-700" : "text-foreground")}>
              £{stats.pendingIncome.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">All unpaid completed lessons</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="history" className="font-bold">Year Transactions</TabsTrigger>
          <TabsTrigger value="unpaid" className="font-bold">
            Unpaid Lessons {unpaidLessons.length > 0 && <Badge className="ml-2 bg-orange-500">{unpaidLessons.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Transaction Log
              </CardTitle>
              <CardDescription>Payments received between {format(taxYearRange.start, "do MMM yyyy")} and {format(taxYearRange.end, "do MMM yyyy")}.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic">No transactions recorded for this period.</div>
              ) : (
                <div className="divide-y">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          tx.type === 'package' ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
                        )}>
                          {tx.type === 'package' ? <Wallet className="h-5 w-5" /> : <PoundSterling className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{tx.student_name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                            {tx.description} • {format(new Date(tx.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-green-600">+£{tx.amount.toFixed(2)}</p>
                        <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase font-bold">Received</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" /> Outstanding Payments
              </CardTitle>
              <CardDescription>Lessons marked as completed but not yet paid or covered by credit.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {unpaidLessons.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic">Great! No outstanding payments.</div>
              ) : (
                <div className="divide-y">
                  {unpaidLessons.map((lesson) => (
                    <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{lesson.students?.name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                            {format(new Date(lesson.start_time), "MMM d, p")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-orange-600">£{lesson.value.toFixed(2)}</p>
                        <Badge variant="destructive" className="text-[8px] h-4 px-1 uppercase font-bold">Unpaid</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Accounts;