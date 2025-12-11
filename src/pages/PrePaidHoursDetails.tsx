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
import { ArrowLeft, Hourglass, PoundSterling, CalendarDays, User, BookOpen, Clock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  id: string; // Transaction ID
  hours_deducted: number;
  transaction_date: string;
  bookings: {
    id: string; // Booking ID
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    status: string;
    lesson_type: string;
  };
}

const PrePaidHoursDetails: React.FC = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [prePaidPackage, setPrePaidPackage] = useState<PrePaidHoursPackage | null>(null);
  const [packageTransactions, setPackageTransactions] = useState<BookingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackageDetails = useCallback(async () => {
    if (!user || !packageId) return;

    setIsLoading(true);
    setError(null);

    const { data: packageData, error: packageError } = await supabase
      .from("pre_paid_hours")
      .select("*, students(name)")
      .eq("id", packageId)
      .eq("user_id", user.id)
      .single();

    if (packageError) {
      console.error("Error fetching pre-paid hours package:", packageError);
      showError("Failed to load package details: " + packageError.message);
      setError("Failed to load package details.");
      setIsLoading(false);
      return;
    }

    if (packageData) {
      setPrePaidPackage(packageData);

      // Now fetch transactions for this specific pre-paid hours package
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("pre_paid_hours_transactions")
        .select("id, hours_deducted, transaction_date, bookings(id, title, description, start_time, end_time, status, lesson_type)")
        .eq("pre_paid_hours_id", packageId)
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: true });

      if (transactionsError) {
        console.error("Error fetching package transactions:", transactionsError);
        showError("Failed to load package transactions: " + transactionsError.message);
        setError("Failed to load package transactions.");
        setPackageTransactions([]);
      } else {
        setPackageTransactions(transactionsData || []);
      }
    } else {
      setError("Pre-paid hours package not found.");
    }
    setIsLoading(false);
  }, [user, packageId]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchPackageDetails();
    }
  }, [isSessionLoading, fetchPackageDetails]);

  const handleDeleteBooking = async (bookingId: string) => {
    if (!user) {
      showError("You must be logged in to delete a booking.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("user_id", user.id); // Ensure user owns the booking

    if (error) {
      console.error("Error deleting booking:", error);
      showError("Failed to delete booking: " + error.message);
    } else {
      showSuccess("Booking deleted successfully! Hours have been returned to the package.");
      fetchPackageDetails(); // Re-fetch details to update remaining hours and transaction list
    }
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" /></CardContent>
        </Card>
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="outline" asChild>
          <Link to="/pre-paid-hours">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pre-Paid Hours
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!prePaidPackage) {
    return (
      <div className="space-y-6">
        <Button variant="outline" asChild>
          <Link to="/pre-paid-hours">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pre-Paid Hours
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Pre-Paid Hours Details</h1>
        <p className="text-muted-foreground">No package found with ID: {packageId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link to="/pre-paid-hours">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pre-Paid Hours
          </Link>
        </Button>
      </div>

      <h1 className="text-3xl font-bold">Pre-Paid Hours Details</h1>

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
          {prePaidPackage.notes && (
            <p className="text-muted-foreground italic">Notes: {prePaidPackage.notes}</p>
          )}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mt-8">Bookings that used hours from this package</h2>
      {packageTransactions.length === 0 ? (
        <p className="text-muted-foreground">No bookings have used hours from this package yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packageTransactions.map((transaction) => (
            <Card key={transaction.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{transaction.bookings.title}</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this booking.
                        <br />
                        <span className="font-bold text-primary">The {transaction.hours_deducted.toFixed(1)} hours deducted for this booking will be returned to this pre-paid package.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteBooking(transaction.bookings.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Booking
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent className="flex-1 space-y-1 text-sm">
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
                {transaction.bookings.description && (
                  <p className="text-muted-foreground italic mt-2">Notes: {transaction.bookings.description}</p>
                )}
                <p className="text-sm font-medium mt-2">Status: <span className="capitalize">{transaction.bookings.status}</span></p>
                <p className="text-sm font-medium text-primary mt-2">Hours Deducted: {transaction.hours_deducted.toFixed(1)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrePaidHoursDetails;