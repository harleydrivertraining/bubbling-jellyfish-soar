"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Hourglass, PoundSterling, CalendarDays, User, BookOpen, Clock, Trash2, MinusCircle, MessageSquare, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DeductPrePaidHoursForm from "@/components/DeductPrePaidHoursForm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PrePaidHoursPackage {
  id: string;
  student_id: string;
  package_hours: number;
  remaining_hours: number;
  amount_paid?: number;
  purchase_date: string;
  notes?: string;
  students: {
    name: string;
  };
}

interface BookingTransaction {
  id: string;
  hours_deducted: number;
  transaction_date: string;
  notes?: string;
  booking_id?: string | null;
  bookings: {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    status: string;
    lesson_type: string;
  } | null;
}

const PrePaidHoursDetails: React.FC = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [prePaidPackage, setPrePaidPackage] = useState<PrePaidHoursPackage | null>(null);
  const [packageTransactions, setPackageTransactions] = useState<BookingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeductDialogOpen, setIsDeductDialogOpen] = useState(false);

  const fetchPackageDetails = useCallback(async () => {
    if (!user || !packageId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: packageData, error: packageError } = await supabase
        .from("pre_paid_hours")
        .select("*, students(name)")
        .eq("id", packageId)
        .eq("user_id", user.id)
        .single();

      if (packageError) throw packageError;

      if (packageData) {
        setPrePaidPackage(packageData);

        const { data: transactionsData, error: transactionsError } = await supabase
          .from("pre_paid_hours_transactions")
          .select("id, hours_deducted, transaction_date, notes, booking_id, bookings(id, title, description, start_time, end_time, status, lesson_type)")
          .eq("pre_paid_hours_id", packageId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false });

        if (transactionsError) throw transactionsError;
        setPackageTransactions(transactionsData || []);
      }
    } catch (err: any) {
      console.error("Error fetching package details:", err);
      showError("Failed to load data: " + err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, packageId]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchPackageDetails();
    }
  }, [isSessionLoading, fetchPackageDetails]);

  const handleDeleteBooking = async (bookingId: string) => {
    if (!user) return;
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) showError("Failed to delete booking: " + error.message);
    else {
      showSuccess("Booking deleted and hours returned.");
      fetchPackageDetails();
    }
  };

  const handleDeleteManualTransaction = async (transactionId: string, hoursToReturn: number) => {
    if (!user || !prePaidPackage) return;

    const { error: updateError } = await supabase
      .from("pre_paid_hours")
      .update({ remaining_hours: prePaidPackage.remaining_hours + hoursToReturn })
      .eq("id", packageId);

    if (updateError) {
      showError("Failed to return hours: " + updateError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("pre_paid_hours_transactions")
      .delete()
      .eq("id", transactionId);

    if (deleteError) showError("Failed to delete record: " + deleteError.message);
    else {
      showSuccess("Manual deduction reversed.");
      fetchPackageDetails();
    }
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (error || !prePaidPackage) {
    return (
      <div className="space-y-6">
        <Button variant="outline" asChild><Link to="/pre-paid-hours"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
        <h1 className="text-3xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error || "Package not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/pre-paid-hours">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchPackageDetails} title="Refresh data">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={isDeductDialogOpen} onOpenChange={setIsDeductDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <MinusCircle className="mr-2 h-4 w-4" /> Deduct Hours Manually
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Manual Hour Deduction</DialogTitle>
            </DialogHeader>
            <DeductPrePaidHoursForm
              packageId={prePaidPackage.id}
              studentId={prePaidPackage.student_id}
              remainingHours={prePaidPackage.remaining_hours}
              onDeducted={fetchPackageDetails}
              onClose={() => setIsDeductDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            {prePaidPackage.students?.name || "Unknown Student"}
          </CardTitle>
          <CardDescription className="flex items-center text-primary font-bold text-xl mt-2">
            <Hourglass className="mr-2 h-5 w-5" />
            <span>{prePaidPackage.remaining_hours.toFixed(1)} / {prePaidPackage.package_hours.toFixed(1)} hrs remaining</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {prePaidPackage.amount_paid !== null && (
            <div className="flex items-center text-muted-foreground">
              <PoundSterling className="mr-2 h-4 w-4" />
              <span>Amount Paid: £{prePaidPackage.amount_paid.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center text-muted-foreground">
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>Purchase Date: {format(new Date(prePaidPackage.purchase_date), "PPP")}</span>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mt-8">Usage History</h2>
      {packageTransactions.length === 0 ? (
        <p className="text-muted-foreground">No hours have been used from this package yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packageTransactions.map((transaction) => {
            const isManual = !transaction.booking_id;
            
            return (
              <Card key={transaction.id} className={cn("flex flex-col", isManual && "border-destructive/20 bg-destructive/5")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg">
                      {transaction.bookings ? transaction.bookings.title : "Manual Deduction"}
                    </CardTitle>
                    {isManual && (
                      <Badge variant="destructive" className="w-fit text-[10px] font-bold uppercase">Manual Adjustment</Badge>
                    )}
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isManual ? "Reverse Manual Deduction?" : "Delete Booking?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will return <span className="font-bold text-primary">{transaction.hours_deducted.toFixed(1)} hours</span> to the package balance.
                          {!isManual && " This will also permanently delete the booking record."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => isManual ? handleDeleteManualTransaction(transaction.id, transaction.hours_deducted) : handleDeleteBooking(transaction.booking_id!)} 
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent className="flex-1 space-y-1 text-sm">
                  {!isManual && transaction.bookings ? (
                    <>
                      <CardDescription className="flex items-center text-muted-foreground">
                        <BookOpen className="mr-2 h-4 w-4" />
                        <span>{transaction.bookings.lesson_type}</span>
                      </CardDescription>
                      <div className="flex items-center text-muted-foreground">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>{format(new Date(transaction.bookings.start_time), "PPP")}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        <span>{format(new Date(transaction.bookings.start_time), "p")} - {format(new Date(transaction.bookings.end_time), "p")}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center text-muted-foreground">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>Date: {format(new Date(transaction.transaction_date), "PPP")}</span>
                      </div>
                      {transaction.notes && (
                        <div className="flex items-start text-muted-foreground mt-2 bg-white/50 p-2 rounded border border-destructive/10">
                          <MessageSquare className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                          <p className="italic">"{transaction.notes}"</p>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-sm font-bold text-primary mt-2">Hours Deducted: {transaction.hours_deducted.toFixed(1)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PrePaidHoursDetails;