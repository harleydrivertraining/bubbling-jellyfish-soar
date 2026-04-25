"use client";

import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, parseISO, startOfMonth } from "date-fns";
import { 
  Car, 
  CalendarDays, 
  PoundSterling, 
  Clock, 
  AlertTriangle, 
  Info,
  Ban,
  GraduationCap,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const PublicInstructorPage = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: instructor, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-instructor', identifier],
    queryFn: async () => {
      if (!identifier) return null;

      // Try fetching by slug first
      const { data: bySlug } = await supabase
        .from("profiles")
        .select("*")
        .eq("public_slug", identifier)
        .eq("is_public", true)
        .maybeSingle();
      
      if (bySlug) return bySlug;

      // Fallback to ID if it's a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(identifier)) {
        const { data: byId } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", identifier)
          .eq("is_public", true)
          .maybeSingle();
        
        return byId;
      }

      return null;
    },
    enabled: !!identifier
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
    queryKey: ['public-unavailability', instructor?.id, instructor?.auto_hide_test_dates],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date().toISOString();

      const queries = [
        supabase
          .from("instructor_unavailability")
          .select("*")
          .eq("user_id", instructor!.id)
          .gte("end_date", today)
      ];

      if (instructor?.auto_hide_test_dates !== false) {
        queries.push(
          supabase.from("bookings")
            .select("start_time")
            .eq("user_id", instructor!.id)
            .eq("lesson_type", "Driving Test")
            .neq("status", "cancelled")
            .gte("start_time", now)
        );
      }

      const results = await Promise.all(queries);
      
      return {
        manual: results[0].data || [],
        tests: results[1]?.data || []
      };
    },
    enabled: !!instructor?.id
  });

  const groupedAvailability = useMemo(() => {
    const groups: Record<string, { slots: any[], sortDate: number }> = {};
    
    availability.forEach(slot => {
      const date = parseISO(slot.start_time);
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = { slots: [], sortDate: startOfMonth(date).getTime() };
      }
      groups[monthKey].slots.push(slot);
    });

    return Object.entries(groups).sort((a, b) => a[1].sortDate - b[1].sortDate);
  }, [availability]);

  const groupedRestrictions = useMemo(() => {
    const groups: Record<string, { manual: any[], tests: any[], sortDate: number }> = {};
    
    unavailability.manual.forEach(item => {
      const date = parseISO(item.start_date);
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = { manual: [], tests: [], sortDate: startOfMonth(date).getTime() };
      }
      groups[monthKey].manual.push(item);
    });

    unavailability.tests.forEach(test => {
      const date = parseISO(test.start_time);
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = { manual: [], tests: [], sortDate: startOfMonth(date).getTime() };
      }
      groups[monthKey].tests.push(test);
    });

    return Object.entries(groups).sort((a, b) => a[1].sortDate - b[1].sortDate);
  }, [unavailability]);

  if (isLoadingProfile) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 md:col-span-2 rounded-2xl" />
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
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="h-32 bg-primary/5 border-b" />
          <div className="px-6 pb-8 -mt-12 flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="h-24 w-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
              {instructor.logo_url ? (
                <img src={instructor.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <Car className="h-12 w-12 text-primary/20" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-3xl font-black tracking-tight">{instructor.first_name} {instructor.last_name}</h1>
              <p className="text-muted-foreground font-medium flex items-center justify-center sm:justify-start gap-2">
                <GraduationCap className="h-4 w-4 text-primary/60" /> Professional Driving Instructor
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Rates & Bio */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-green-600 text-white pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PoundSterling className="h-5 w-5" /> Lesson Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[
                  { label: "1 Hour", value: instructor.rate_1h || instructor.hourly_rate },
                  { label: "1.5 Hours", value: instructor.rate_1_5h || ((instructor.hourly_rate || 0) * 1.5) },
                  { label: "2 Hours", value: instructor.rate_2h || ((instructor.hourly_rate || 0) * 2) }
                ].map((rate, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-xl border border-muted">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight">{rate.label}</span>
                    <span className="font-black text-lg text-primary">£{Number(rate.value).toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {instructor.public_bio && (
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-blue-600 text-white pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5" /> About Me
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-muted">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                      "{instructor.public_bio}"
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Availability & Restrictions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Availability Section */}
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-white pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" /> Current Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {groupedAvailability.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed">
                    No public slots available right now. Please contact the instructor directly.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedAvailability.map(([month, data]) => (
                      <div key={month} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-primary/10 text-primary font-black px-4 py-1 rounded-full uppercase text-[10px] tracking-widest border-none">
                            {month}
                          </Badge>
                          <div className="h-px flex-1 bg-muted" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {data.slots.map((slot, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-muted hover:bg-muted/50 transition-colors group">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-primary">{format(parseISO(slot.start_time), "EEEE, do")}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                                  <Clock className="h-3 w-3" /> {format(parseISO(slot.start_time), "p")} — {format(parseISO(slot.end_time), "p")}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Restrictions Section */}
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-orange-600 text-white pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Driving Test Restrictions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <CardDescription className="text-xs text-muted-foreground mb-6 font-medium italic">
                  Please avoid booking driving tests on these dates as the instructor is unavailable.
                </CardDescription>

                {groupedRestrictions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground italic text-sm bg-muted/20 rounded-xl border border-dashed">
                    No specific test restrictions currently listed.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedRestrictions.map(([month, items]) => (
                      <div key={month} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-black border-orange-200 text-orange-700 bg-orange-50 px-4 py-1 rounded-full uppercase text-[10px] tracking-widest">
                            {month}
                          </Badge>
                          <div className="h-px flex-1 bg-muted" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {items.manual.map((item, i) => (
                            <div key={`manual-${i}`} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-muted">
                              <Ban className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-bold text-primary">
                                  {format(parseISO(item.start_date), "do")} 
                                  {item.start_date !== item.end_date && ` — ${format(parseISO(item.end_date), "do")}`}
                                </p>
                                {item.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{item.reason}"</p>}
                              </div>
                            </div>
                          ))}
                          {items.tests.map((test, i) => (
                            <div key={`test-${i}`} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-muted">
                              <Car className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-bold text-primary">
                                  {format(parseISO(test.start_time), "EEEE, do")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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