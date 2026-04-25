"use client";

import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth } from "date-fns";
import { Car, Ban, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EmbedRestrictions = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: instructor, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-instructor-embed', identifier],
    queryFn: async () => {
      if (!identifier) return null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      const { data: bySlug } = await supabase
        .from("profiles")
        .select("id, auto_hide_test_dates")
        .eq("public_slug", identifier)
        .eq("is_public", true)
        .maybeSingle();
      
      if (bySlug) return bySlug;

      if (uuidRegex.test(identifier)) {
        const { data: byId } = await supabase
          .from("profiles")
          .select("id, auto_hide_test_dates")
          .eq("id", identifier)
          .eq("is_public", true)
          .maybeSingle();
        return byId;
      }
      return null;
    },
    enabled: !!identifier
  });

  const { data: unavailability = { manual: [], tests: [] }, isLoading: isLoadingData } = useQuery({
    queryKey: ['public-unavailability-embed', instructor?.id],
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

  if (isLoadingProfile || isLoadingData) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!instructor) {
    return <div className="p-4 text-center text-xs text-muted-foreground italic">Profile not found or private.</div>;
  }

  return (
    <div className="bg-transparent p-1 font-sans">
      {groupedRestrictions.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground italic text-sm border border-dashed rounded-xl">
          No specific test restrictions currently listed.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedRestrictions.map(([month, data]) => (
            <div key={month} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 text-white font-black px-3 py-1 rounded-md uppercase text-[10px] tracking-widest shadow-sm">
                  {month}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {item.type === 'manual' ? (
                      <Ban className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                    ) : (
                      <Car className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
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
                        <p className="text-[10px] text-slate-500 mt-0.5 italic truncate">"{item.reason}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmbedRestrictions;