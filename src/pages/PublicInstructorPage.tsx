"use client";

import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { 
  Car, 
  CalendarDays, 
  PoundSterling, 
  Clock, 
  AlertTriangle, 
  Info,
  Ban,
  GraduationCap
} from "lucide-react";

const PublicInstructorPage = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: instructor, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-instructor', identifier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${identifier},public_slug.eq.${identifier}`)
        .eq("is_public", true)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['public-availability', instructor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("start_time, end_time, lesson_type")
        .eq("user_id", instructor!.id)
        .eq("status", "available")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true });
      return data || [];
    },
    enabled: !!instructor?.id
  });

  const { data: unavailability = { manual: [], tests: [] } } = useQuery({
    queryKey: ['public-unavailability', instructor?.id],
    queryFn: async () => {
      const [manualRes, testsRes] = await Promise.all([
        supabase.from("instructor_unavailability").select("*").eq("user_id", instructor!.id),
        supabase.from("bookings").select("start_time").eq("user_id", instructor!.id).eq("lesson_type", "Driving Test").neq("status", "cancelled")
      ]);
      
      return {
        manual: manualRes.data || [],
        tests: testsRes.data || []
      };
    },
    enabled: !!instructor?.id
  });

  if (isLoadingProfile) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Ban className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Profile Not Found</h1>
        <p className="text-muted-foreground mt-2">This instructor profile is either private or does not exist.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Return to App</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="h-32 bg-primary/5 border-b" />
          <div className="px-6 pb-8 -mt-12 flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="h-24 w-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              {instructor.logo_url ? (
                <img src={instructor.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <Car className="h-12 w-12 text-primary/20" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-3xl font-black tracking-tight">{instructor.first_name} {instructor.last_name}</h1>
              <p className="text-muted-foreground font-medium flex items-center justify-center sm:justify-start gap-2">
                <GraduationCap className="h-4 w-4" /> Professional Driving Instructor
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PoundSterling className="h-5 w-5 text-green-600" /> Lesson Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-bold">1 Hour</span>
                  <span className="font-black text-lg">£{instructor.rate_1h || instructor.hourly_rate || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-bold">1.5 Hours</span>
                  <span className="font-black text-lg">£{instructor.rate_1_5h || ((instructor.hourly_rate || 0) * 1.5).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-bold">2 Hours</span>
                  <span className="font-black text-lg">£{instructor.rate_2h || ((instructor.hourly_rate || 0) * 2).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {instructor.public_bio && (
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" /> About Me
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {instructor.public_bio}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" /> Current Availability
                </CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Upcoming slots available for booking.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {availability.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground italic">
                    No public slots available right now. Please contact the instructor directly.
                  </div>
                ) : (
                  <div className="divide-y">
                    {availability.slice(0, 10).map((slot: any, i: number) => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="space-y-1">
                          <p className="font-bold">{format(parseISO(slot.start_time), "EEEE, MMMM do")}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" /> {format(parseISO(slot.start_time), "p")} — {format(parseISO(slot.end_time), "p")}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" /> Driving Test Restrictions
                </CardTitle>
                <CardDescription>
                  Please do not book driving tests on these dates without prior approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {unavailability.manual?.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <Ban className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-orange-900">
                        {format(parseISO(item.start_date), "MMM do")} 
                        {item.start_date !== item.end_date && ` — ${format(parseISO(item.end_date), "MMM do")}`}
                      </p>
                      {item.reason && <p className="text-xs text-orange-800/70 mt-0.5">{item.reason}</p>}
                    </div>
                  </div>
                ))}

                {unavailability.tests?.map((test: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Car className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        {format(parseISO(test.start_time), "EEEE, MMMM do")}
                      </p>
                      <p className="text-xs text-blue-800/70 mt-0.5">Instructor already has a test booked on this day.</p>
                    </div>
                  </div>
                ))}

                {unavailability.manual?.length === 0 && unavailability.tests?.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">
                    No specific test restrictions currently listed.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicInstructorPage;