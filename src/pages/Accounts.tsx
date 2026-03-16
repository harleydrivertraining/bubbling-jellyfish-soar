"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { 
  PoundSterling, 
  TrendingUp, 
  Clock, 
  CalendarDays, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  Receipt,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: 'lesson' | 'package';
  date: string;
  amount: number;
  description: string;
  student_name: string;
  status: string;
}

const Accounts: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [unpaidLessons, setUnpaidLessons] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Get Profile (Hourly Rate)
      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", user.id)
        .single();
      
      const rate = profile?.hourly_rate || 0;
      setHourlyRate(rate);

      // 2. Get Pre-paid Packages (Income)
      const { data: packages } = await supabase
        .from("pre_paid_hours")
        .select("id, amount_paid, purchase_date, students(name)")
        .eq("user_id", user.id);

      // 3. Get Completed Lessons (to find unpaid ones)
      const { data: lessons } = await supabase
        .from("bookings")
        .select("id, title, start_time, end_time, is_paid, status, students(name)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("start_time", { ascending: false });

      // 4. Get Credit Transactions (to see which lessons were paid by credit)
      const { data: creditTx } = await supabase
        .from("pre_paid_hours_transactions")
        .select("booking_id")
        .eq("user_id", user.id);
      
      const creditPaidIds = new Set(creditTx?.map(t => t.booking_id) || []);

      // Process Transactions
      const allTx: Transaction[] = [];

      // Add Packages
      packages?.forEach(pkg => {
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

      // Add Lessons (only if paid directly, not via credit)
      const unpaid: any[] = [];
      lessons?.forEach(lesson => {
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

      setTransactions(allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    
    const totalIncome = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const monthIncome = transactions
      .filter(tx => new Date(tx.date) >= thisMonthStart)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const pendingIncome = unpaidLessons.reduce((sum, l) => sum + l.value, 0);

    return { totalIncome, monthIncome, pendingIncome };
  }, [transactions, unpaidLessons]);

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Accounts</h1>
          <p className="text-muted-foreground font-medium">Track your earnings and pending payments.</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 px-4 py-2 rounded-lg">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Current Rate</p>
          <p className="text-lg font-black text-primary">£{hourlyRate.toFixed(2)}/hr</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-green-600" /> Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">£{stats.totalIncome.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">All-time recorded earnings</p>
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
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Earnings since {format(startOfMonth(new Date()), "MMM 1st")}</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", stats.pendingIncome > 0 ? "border-l-orange-500 bg-orange-50/30" : "border-l-muted")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 text-orange-600" /> Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-black", stats.pendingIncome > 0 ? "text-orange-700" : "text-foreground")}>
              £{stats.pendingIncome.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Unpaid completed lessons</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="history" className="font-bold">Payment History</TabsTrigger>
          <TabsTrigger value="unpaid" className="font-bold">
            Unpaid Lessons {unpaidLessons.length > 0 && <Badge className="ml-2 bg-orange-500">{unpaidLessons.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Recent Transactions
              </CardTitle>
              <CardDescription>A log of all payments received from students.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic">No transactions recorded yet.</div>
              ) : (
                <div className="divide-y">
                  {transactions.map((tx) => (
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