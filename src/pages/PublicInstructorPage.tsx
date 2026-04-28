"use client";

import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  format, 
  parseISO, 
  startOfMonth, 
  addHours, 
  addWeeks, 
  startOfDay, 
  setHours, 
  setMinutes, 
  differenceInMinutes,
  isSameDay
} from "date-fns";
import { 
  Car, 
  CalendarDays, 
  PoundSterling, 
  Clock, 
  AlertTriangle, 
  Info,
  Ban,
  GraduationCap,
  ChevronRight,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";

const PublicInstructorPage = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: instructor, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-instructor', identifier],
    queryFn: async () => {
      if (!identifier) return null;

      const { data: bySlug } = await supabase
        .from("profiles")
        .select("*")
        .eq("public_slug", identifier)
        .eq("is_public", true)
        .maybeSingle();
      
      if (bySlug) return bySlug;

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

  // Fetch all bookings to calculate gaps
  const { data: allBookings = [] } = useQuery({
    queryKey: ['public-all-bookings', instructor?.id],
    queryFn: async () => {
      // Fetch from start of today to catch any overlapping multi-day events
      const start = startOfDay(new Date()).toISOString();
      const end = addWeeks(new Date(), 4).toISOString(); // Look ahead 4 weeks
      const { data } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("user_id", instructor!.id)
        .gte("end_time", start)
        .lte("start_time", end)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!instructor?.id && !!instructor?.show_availability_publicly
  });

  // Fetch manual restrictions
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

  const calculatedAvailability = useMemo(() => {
    if (!instructor || !instructor.show_availability_publicly) return [];

    const mode = instructor.booking_mode || "gaps";
    const now = new Date();
    const noticeHours = instructor.min_booking_notice_hours ?? 48;
    const advanceWeeks = instructor.max_booking_advance_weeks ?? 12;
    const minStartTimeMs = addHours(now, noticeHours).getTime();
    const maxStartTimeMs = addWeeks(now, advanceWeeks).getTime();
    const durationMs = 60 * 60000; // Default to 1 hour for public preview
    const intervalMs = Math.max(15, instructor.booking_interval_mins || 30) * 60000;
    const bufferMs = (instructor.booking_buffer_mins || 0) * 60000;

    // Busy periods are anything that ISN'T an available slot
    const busyPeriods = allBookings
      .filter(b => b.status !== 'available')
      .map(b => ({
        start: parseISO(b.start_time).getTime() - bufferMs,
        end: parseISO(b.end_time).getTime() + bufferMs
      }));

    const slots: any[] = [];
    const daysToSearch = 14; // Show next 2 weeks

    for (let i = 0; i < daysToSearch; i++) {
      const day = addHours(startOfDay(now), i * 24);
      const dateKey = format(day, 'yyyy-MM-dd');
      
      // Check if this day has a manual restriction
      const isRestricted = unavailability.manual.some(m => 
        isSameDay(parseISO(m.start_date), day) || 
        (day >= parseISO(m.start_date) && day <= parseISO(m.end_date))
      );

      if (isRestricted) continue;

      if (mode === "gaps") {
        const manualGaps = allBookings.filter(b => b.status === 'available' && b.start_time.startsWith(dateKey));
        manualGaps.forEach(gap => {
          const gapStartMs = parseISO(gap.start_time).getTime();
          const gapEndMs = parseISO(gap.end_time).getTime();
          let currentPointerMs = gapStartMs;
          
          while (currentPointerMs + durationMs <= gapEndMs && slots.length < 20) {
            const endPointerMs = currentPointerMs + durationMs;
            const isClashing = busyPeriods.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);
            
            if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
              slots.push({ 
                start_time: new Date(currentPointerMs).toISOString(), 
                end_time: new Date(endPointerMs).toISOString() 
              });
            }
            currentPointerMs += intervalMs;
          }
        });
      } else {
        const dayOfWeek = day.getDay().toString();
        const dayConfig = instructor.working_hours?.[dayOfWeek];
        
        if (dayConfig?.active) {
          const parseTime = (t: any) => {
            if (typeof t === 'number') return [t, 0];
            const parts = (t || "09:00").split(':').map(Number);
            return parts.length === 2 ? parts : [9, 0];
          };
          
          const [startH, startM] = parseTime(dayConfig.start);
          const [endH, endM] = parseTime(dayConfig.end);
          const dayStartMs = setMinutes(setHours(startOfDay(day), startH), startM).getTime();
          const dayEndMs = setMinutes(setHours(startOfDay(day), endH), endM).getTime();

          let currentPointerMs = dayStartMs;
          while (currentPointerMs + durationMs <= dayEndMs && slots.length < 20) {
            const endPointerMs = currentPointerMs + durationMs;
            const isClashing = busyPeriods.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);
            
            if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
              slots.push({ 
                start_time: new Date(currentPointerMs).toISOString(), 
                end_time: new Date(endPointerMs).toISOString() 
              });
            }
            currentPointerMs += intervalMs;
          }
        }
      }
      if (slots.length >= 20) break;
    }
    return slots;
  }, [instructor, allBookings, unavailability.manual]);

  const groupedAvailability = useMemo(() => {
    const groups: Record<string, { slots: any[], sortDate: number }> = {};
    
    calculatedAvailability.forEach(slot => {
      const date = parseISO(slot.start_time);
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = { slots: [], sortDate: startOfMonth(date).getTime() };
      }
      groups[monthKey].slots.push(slot);
    });

    return Object.entries(groups).sort((a, b) => a[1].sortDate - b[1].sortDate);
  }, [calculatedAvailability]);

  const groupedRestrictions = useMemo(() => {
    const allItems: any[] = [
      ...unavailability.manual.map(m => ({ ...m, type: 'manual', date: parseISO(m.start_date) })),
      ...unavailability.tests.map(t => ({ ...t, type: 'test', date: parseISO(t.start_time) }))
    ];

    allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    const groups: Record<string, { items: any[], sortDate: number }> = {};
    
    allItems.forEach(item => {
      const monthKey = format(item.date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = { items: [], sortDate: startOfMonth(item.date).getTime() };
      }
      groups[monthKey].items.push(item);
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

          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-white pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" /> Current Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!instructor.show_availability_publicly ? (
                  <div className="p-12 text-center space-y-3 bg-muted/20 rounded-xl border border-dashed">
                    <EyeOff className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground font-medium">Availability is currently private.</p>
                    <p className="text-xs text-muted-foreground">Please contact the instructor directly to inquire about lessons.</p>
                  </div>
                ) : groupedAvailability.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed">
                    No public slots available right now. Please contact the instructor directly.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedAvailability.map(([month, data]) => (
                      <div key={month} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary text-white font-black px-4 py-1.5 rounded-lg uppercase text-xs tracking-widest shadow-sm">
                            {month}
                          </div>
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
                    {groupedRestrictions.map(([month, data]) => (
                      <div key={month} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-600 text-white font-black px-4 py-1.5 rounded-lg uppercase text-xs tracking-widest shadow-sm">
                            {month}
                          </div>
                          <div className="h-px flex-1 bg-muted" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {data.items.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-muted">
                              {item.type === 'manual' ? (
                                <Ban className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                              ) : (
                                <Car className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                              )}
                              <div>
                                <p className="text-sm font-bold text-primary">
                                  {item.type === 'manual' ? (
                                    <>
                                      {format(item.date, "EEEE, do")} 
                                      {item.start_date !== item.end_date && ` — ${format(parseISO(item.end_date), "do")}`}
                                    </>
                                  ) : (
                                    format(item.date, "EEEE, do")
                                  )}
                                </p>
                                {item.type === 'manual' && item.reason && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">"{item.reason}"</p>
                                )}
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