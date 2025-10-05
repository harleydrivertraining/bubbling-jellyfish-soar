"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Hourglass, PoundSterling, CalendarDays, User, BookOpen, Clock } from "lucide-react";

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

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
}

const PrePaidHoursDetails: React.FC = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const [prePaidPackage, setPrePaidPackage] = useState<PrePaidHoursPackage | null>(null);
  const [studentBookings, setStudentBookings] = useState<Booking[]>([]);
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

      // Now fetch bookings for this student after the package purchase date
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, status, lesson_type")
        .eq("student_id", packageData.student_id)
        .eq("user_id", user.id)
        .gte("start_time", packageData.purchase_date) // Filter bookings after purchase date
        .order("start_time", { ascending: true });

      if (bookingsError) {
        console.error("Error fetching student bookings:", bookingsError);
        showError("Failed to load student bookings: " + bookingsError.message);
        setError("Failed to load student bookings.");
        setStudentBookings([]);
      } else {
        setStudentBookings(bookingsData || []);
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
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
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
      <Button variant="outline" asChild>
        <Link to="/pre-paid-hours">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pre-Paid Hours
        </Link>
      </Button>

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

      <h2 className="text-2xl font-bold mt-8">Bookings for {prePaidPackage.students?.name || "this student"} (since package purchase)</h2>
      {studentBookings.length === 0 ? (
        <p className="text-muted-foreground">No bookings found for this student since the purchase date of this package.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studentBookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <CardTitle className="text-lg">{booking.title}</CardTitle>
                <CardDescription className="flex items-center text-muted-foreground">
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>{booking.lesson_type}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span>{format(new Date(booking.start_time), "PPP")}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}</span>
                </div>
                {booking.description && (
                  <p className="text-muted-foreground italic mt-2">Notes: {booking.description}</p>
                )}
                <p className="text-sm font-medium mt-2">Status: <span className="capitalize">{booking.status}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrePaidHoursDetails;