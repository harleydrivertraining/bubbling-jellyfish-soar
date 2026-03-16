"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isBefore } from "date-fns";
import { 
  PoundSterling, 
  TrendingUp, 
  Clock, 
  CalendarDays, 
  Wallet,
  Receipt,
  User,
  Calendar,
  PlusCircle,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Tag,
  ChevronDown,
  ChevronUp,
  PieChart as PieChartIcon
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AddAdditionalIncomeForm from "@/components/AddAdditionalIncomeForm";
import AddExpenditureForm from "@/components/AddExpenditureForm";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

interface IncomeTransaction {
  id: string;
  type: 'lesson' | 'package' | 'additional';
  date: string;
  amount: number;
  description: string;
  student_name: string;
  category: string;
}

interface ExpenditureTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const getTaxYearRange = (startYear: number) => {
  const start = new Date(startYear, 3, 6);
  const end = new Date(startYear + 1, 3, 5, 23, 59, 59);
  return { start, end };
};

const getTaxYearStartForDate = (date: Date) => {
  const year = date.getFullYear();
  const taxYearStartThisYear = new Date(year, 3, 6);
  return isBefore(date, taxYearStartThisYear) ? year - 1 : year;
};

const Accounts: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [incomeTransactions, setIncomeTransactions] = useState<IncomeTransaction[]>([]);
  const [expenditureTransactions, setExpenditureTransactions] = useState<ExpenditureTransaction[]>([]);
  const [unpaidLessons, setUnpaidLessons] = useState<any[]>([]);
  
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isIncomeLogExpanded, setIsIncomeLogExpanded] = useState(false);
  
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

      const [packagesRes, lessonsRes, creditTxRes, additionalRes, expensesRes] = await Promise.all([
        supabase.from("pre_paid_hours").select("id, amount_paid, purchase_date, students(name)").eq("user_id", user.id),
        supabase.from("bookings").select("id, title, start_time, end_time, is_paid, status, students(name)").eq("user_id", user.id).eq("status", "completed").order("start_time", { ascending: false }),
        supabase.from("pre_paid_hours_transactions").select("booking_id").eq("user_id", user.id),
        supabase.from("additional_income").select("*").eq("user_id", user.id),
        supabase.from("expenditures").select("*").eq("user_id", user.id)
      ]);

      const creditPaidIds = new Set(creditTxRes.data?.map(t => t.booking_id) || []);
      const income: IncomeTransaction[] = [];
      const unpaid: any[] = [];

      // 1. Packages
      packagesRes.data?.forEach(pkg => {
        if (pkg.amount_paid) {
          income.push({
            id: pkg.id,
            type: 'package',
            date: pkg.purchase_date,
            amount: pkg.amount_paid,
            description: "Pre-paid Hours Package",
            student_name: (pkg.students as any)?.name || "Unknown",
            category: "Block Bookings"
          });
        }
      });

      // 2. Lessons
      lessonsRes.data?.forEach(lesson => {
        const isCredit = creditPaidIds.has(lesson.id);
        const duration = (new Date(lesson.end_time).getTime() - new Date(lesson.start_time).getTime()) / 3600000;
        const value = duration * rate;

        if (lesson.is_paid && !isCredit) {
          income.push({
            id: lesson.id,
            type: 'lesson',
            date: lesson.start_time,
            amount: value,
            description: "Individual Lesson Payment",
            student_name: (lesson.students as any)?.name || "Unknown",
            category: "Driving Lessons"
          });
        } else if (!lesson.is_paid && !isCredit) {
          unpaid.push({ ...lesson, value });
        }
      });

      // 3. Additional Income
      additionalRes.data?.forEach(item => {
        income.push({
          id: item.id,
          type: 'additional',
          date: item.date,
          amount: item.amount,
          description: item.description,
          student_name: "Other Income",
          category: item.category || "Other"
        });
      });

      setIncomeTransactions(income.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setExpenditureTransactions((expensesRes.data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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

  const filteredIncome = useMemo(() => {
    return incomeTransactions.filter(tx => {
      const date = new Date(tx.date);
      return date >= taxYearRange.start && date <= taxYearRange.end;
    });
  }, [incomeTransactions, taxYearRange]);

  const filteredExpenditure = useMemo(() => {
    return expenditureTransactions.filter(tx => {
      const date = new Date(tx.date);
      return date >= taxYearRange.start && date <= taxYearRange.end;
    });
  }, [expenditureTransactions, taxYearRange]);

  const stats = useMemo(() => {
    const totalIncome = filteredIncome.reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenditure = filteredExpenditure.reduce((sum, tx) => sum + tx.amount, 0);
    const netProfit = totalIncome - totalExpenditure;
    
    const pendingIncome = unpaidLessons.reduce((sum, l) => sum + l.value, 0);

    // Group income by category for chart and cards
    const categoryMap: Record<string, number> = {};
    filteredIncome.forEach(tx => {
      categoryMap[tx.category] = (categoryMap[tx.category] || 0) + tx.amount;
    });

    const chartData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { totalIncome, totalExpenditure, netProfit, pendingIncome, chartData };
  }, [filteredIncome, filteredExpenditure, unpaidLessons]);

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
        
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isAddIncomeOpen} onOpenChange={setIsAddIncomeOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold bg-green-600 hover:bg-green-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Income
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Additional Income</DialogTitle>
              </DialogHeader>
              <AddAdditionalIncomeForm onSuccess={fetchData} onClose={() => setIsAddIncomeOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-bold border-red-200 text-red-700 hover:bg-red-50">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Expenditure
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Business Expenditure</DialogTitle>
              </DialogHeader>
              <AddExpenditureForm onSuccess={fetchData} onClose={() => setIsAddExpenseOpen(false)} />
            </DialogContent>
          </Dialog>

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
              <ArrowUpCircle className="h-3 w-3 text-green-600" /> Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-700">£{stats.totalIncome.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Gross earnings for the year</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <ArrowDownCircle className="h-3 w-3 text-red-600" /> Total Expenditure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-700">£{stats.totalExpenditure.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Business costs for the year</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", stats.netProfit >= 0 ? "border-l-blue-500" : "border-l-orange-500")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Calculator className="h-3 w-3 text-blue-600" /> Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-black", stats.netProfit >= 0 ? "text-blue-700" : "text-orange-700")}>
              £{stats.netProfit.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Income minus expenditure</p>
          </CardContent>
        </Card>
      </div>

      {/* New Summary Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-green-600" /> Income by Category
            </CardTitle>
            <CardDescription>Breakdown of your top earning categories.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.chartData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground italic">No income data to summarize.</p>
              ) : (
                stats.chartData.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-bold text-sm">{item.name}</span>
                    </div>
                    <span className="font-black text-green-600">£{item.value.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-600" /> Revenue Distribution
            </CardTitle>
            <CardDescription>Visual representation of your income sources.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground italic">No data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => `£${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="income" className="font-bold">Income History</TabsTrigger>
          <TabsTrigger value="expenditure" className="font-bold">Expenditure History</TabsTrigger>
          <TabsTrigger value="unpaid" className="font-bold">
            Unpaid {unpaidLessons.length > 0 && <Badge className="ml-2 bg-orange-500">{unpaidLessons.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-6">
          <Collapsible open={isIncomeLogExpanded} onOpenChange={setIsIncomeLogExpanded}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowUpCircle className="h-5 w-5 text-green-600" /> Income Log
                  </CardTitle>
                  <CardDescription>All payments received in the selected tax year.</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    {isIncomeLogExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-0 border-t">
                  {filteredIncome.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground italic">No income recorded for this period.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredIncome.map((tx) => (
                        <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                              tx.type === 'package' ? "bg-purple-100 text-purple-700" : 
                              tx.type === 'additional' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                            )}>
                              {tx.type === 'package' ? <Wallet className="h-5 w-5" /> : 
                               tx.type === 'additional' ? <Coins className="h-5 w-5" /> : <PoundSterling className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{tx.student_name}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                                {tx.category} • {format(new Date(tx.date), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-lg text-green-600">+£{tx.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="expenditure" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-red-600" /> Expenditure Log
              </CardTitle>
              <CardDescription>All business costs recorded in the selected tax year.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExpenditure.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic">No expenditures recorded for this period.</div>
              ) : (
                <div className="divide-y">
                  {filteredExpenditure.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                          <Tag className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                            {tx.category} • {format(new Date(tx.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-red-600">-£{tx.amount.toFixed(2)}</p>
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