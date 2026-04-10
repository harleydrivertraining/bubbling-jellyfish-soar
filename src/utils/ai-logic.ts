import { supabase } from "@/integrations/supabase/client";
import { 
  format, 
  addDays, 
  subDays,
  startOfTomorrow, 
  startOfYesterday,
  setHours, 
  setMinutes, 
  addMinutes, 
  nextDay, 
  previousDay,
  parse, 
  isValid, 
  setMonth, 
  setDate,
  startOfDay,
  endOfDay,
  isBefore,
  addYears,
  parseISO,
  addWeeks,
  isSameDay
} from "date-fns";

export interface AIResponse {
  success: boolean;
  message: string;
  actionTaken?: string;
  newContext?: any;
}

/**
 * Helper to parse date and time from natural language
 */
const parseDateTime = (input: string): { date: Date; timeProvided: boolean } => {
  const now = new Date();
  let targetDate = startOfDay(now);
  let timeProvided = false;
  
  // 1. DATE PARSING
  if (input.includes("tomorrow")) {
    targetDate = startOfTomorrow();
  } else if (input.includes("yesterday")) {
    targetDate = startOfYesterday();
  } else if (input.includes("last ")) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayIndex = days.findIndex(d => input.includes("last " + d));
    if (dayIndex !== -1) {
      targetDate = previousDay(now, dayIndex as any);
    }
  } else {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayIndex = days.findIndex(d => input.includes(d));
    if (dayIndex !== -1) {
      targetDate = nextDay(now, dayIndex as any);
    } else {
      // Match "9th March", "March 9", "09/03"
      const dateMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\/|\s+)(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
                        input.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
      
      if (dateMatch) {
        let day: number;
        let monthStr: string;

        if (isNaN(parseInt(dateMatch[1]))) {
          // Format: March 9
          monthStr = dateMatch[1].toLowerCase();
          day = parseInt(dateMatch[2]);
        } else {
          // Format: 9th March
          day = parseInt(dateMatch[1]);
          monthStr = dateMatch[2].toLowerCase();
        }

        let month = isNaN(parseInt(monthStr)) 
          ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthStr.substring(0, 3)) 
          : parseInt(monthStr) - 1;
        
        if (month !== -1) {
          targetDate = setMonth(setDate(targetDate, day), month);
          
          const sixMonthsAgo = subDays(now, 180);
          if (isBefore(targetDate, sixMonthsAgo) && (input.includes("book") || input.includes("add") || input.includes("create"))) {
            targetDate = addYears(targetDate, 1);
          }
        }
      }
    }
  }

  // 2. TIME PARSING
  let finalTime = targetDate;
  const timeMatch = input.match(/(?:at\s+)?(\d+)(?::(\d+))?\s*(am|pm)?/i);
  
  const hasExplicitTime = timeMatch && (timeMatch[3] || input.includes("at " + timeMatch[1]) || timeMatch[2]);

  if (hasExplicitTime) {
    timeProvided = true;
    let hours = parseInt(timeMatch[1]);
    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    
    if (!ampm && hours < 8) hours += 12; 
    
    finalTime = setHours(setMinutes(targetDate, mins), hours);
  } else {
    finalTime = startOfDay(targetDate);
  }

  return { date: finalTime, timeProvided };
};

/**
 * This is a 'Smart Parser'. It scans the input for known entities (students, topics)
 * and patterns (amounts, dates, times) to perform actions.
 */
export const processAICommand = async (text: string, userId: string, context?: any): Promise<AIResponse> => {
  try {
    const input = text.toLowerCase();

    // 0. CHECK CONTEXT FOR PENDING ACTIONS
    if (context?.pendingNoteForLessonId) {
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, title")
        .eq("id", context.pendingNoteForLessonId)
        .single();

      if (!fetchError && booking) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ description: text.trim() })
          .eq("id", booking.id);

        if (!updateError) {
          return { 
            success: true, 
            message: `Got it. I've added that note to ${booking.title}.`,
            actionTaken: "lesson_note_followup",
            newContext: null 
          };
        }
      }
    }

    if (context?.pendingTargetForLessonId) {
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, title")
        .eq("id", context.pendingTargetForLessonId)
        .single();

      if (!fetchError && booking) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ targets_for_next_session: text.trim() })
          .eq("id", booking.id);

        if (!updateError) {
          return { 
            success: true, 
            message: `Got it. I've set that target for ${booking.title}.`,
            actionTaken: "lesson_target_followup",
            newContext: null 
          };
        }
      }
    }

    // 1. FETCH ENTITIES
    const [studentsRes, topicsRes] = await Promise.all([
      supabase.from("students").select("id, name").eq("user_id", userId),
      supabase.from("progress_topics").select("id, name").or(`user_id.eq.${userId},is_default.eq.true`)
    ]);

    const students = studentsRes.data || [];
    const topics = topicsRes.data || [];

    // 2. ADD EXPENSE PATTERN
    const expenseMatch = input.match(/add (?:£|\$)?(\d+(?:\.\d+)?) (\w+) expense(?: (.+))?/i);
    if (expenseMatch) {
      const [_, amount, category, description] = expenseMatch;
      const { error } = await supabase.from("expenditures").insert({
        user_id: userId,
        amount: parseFloat(amount),
        category: category.charAt(0).toUpperCase() + category.slice(1),
        description: description || `AI Added: ${category}`,
        date: format(new Date(), "yyyy-MM-dd")
      });

      if (error) return { success: false, message: "Failed to add expense: " + error.message };
      return { success: true, message: `Added £${amount} expense for ${category}.`, actionTaken: "expense" };
    }

    // 3. FIND BOOKING HELPER
    const findTargetBooking = async (searchStr: string) => {
      const { date: targetTime, timeProvided } = parseDateTime(searchStr);
      const student = students.find(s => searchStr.includes(s.name.toLowerCase()));
      
      let query = supabase
        .from("bookings")
        .select("id, title, start_time, status")
        .eq("user_id", userId);

      if (timeProvided) {
        query = query.eq("start_time", targetTime.toISOString());
      } else {
        query = query.gte("start_time", startOfDay(targetTime).toISOString())
                     .lte("start_time", endOfDay(targetTime).toISOString());
      }

      if (student) {
        query = query.eq("student_id", student.id);
      }

      const { data: matches, error } = await query;
      return { matches: matches || [], targetTime, timeProvided, student, error };
    };

    // 4. DELETE/CANCEL BOOKING PATTERN
    if (input.includes("delete") || input.includes("cancel") || input.includes("remove")) {
      if (input.includes("booking") || input.includes("lesson") || input.includes("slot") || input.includes("test") || input.includes("gap") || input.includes("space")) {
        const { matches, targetTime, timeProvided, student } = await findTargetBooking(input);
        
        if (matches.length === 0) {
          return { 
            success: false, 
            message: `I couldn't find a booking on ${format(targetTime, "MMM do")}${student ? ' for ' + student.name : ''}.` 
          };
        }

        if (matches.length > 1 && !timeProvided) {
          const times = matches.map(m => format(parseISO(m.start_time), "p")).join(", ");
          return { success: false, message: `I found multiple lessons on that day (at ${times}). Which one should I delete?` };
        }

        const bookingToDelete = matches[0];
        const { error: deleteError } = await supabase.from("bookings").delete().eq("id", bookingToDelete.id);

        if (deleteError) return { success: false, message: "Failed to delete: " + deleteError.message };
        return { 
          success: true, 
          message: `Deleted the booking: "${bookingToDelete.title}" at ${format(parseISO(bookingToDelete.start_time), "p")} on ${format(parseISO(bookingToDelete.start_time), "MMM do")}.`,
          actionTaken: "delete_booking"
        };
      }
    }

    // 5. UPDATE BOOKING STATUS
    const isStatusUpdate = input.includes("complete") || 
                           input.includes("done") || 
                           input.includes("finished") || 
                           input.includes("paid") || 
                           input.includes("settled");

    if (isStatusUpdate) {
      const isAll = input.includes("all") || input.includes("everything") || input.includes("every lesson");
      const { date: targetTime } = parseDateTime(input);
      
      if (isAll && (input.includes("complete") || input.includes("done") || input.includes("finished"))) {
        const { data: toUpdate } = await supabase
          .from("bookings")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .gte("start_time", startOfDay(targetTime).toISOString())
          .lte("start_time", endOfDay(targetTime).toISOString());
          
        if (!toUpdate || toUpdate.length === 0) return { success: false, message: `No scheduled lessons found on ${format(targetTime, "MMM do")}.` };
        
        await supabase.from("bookings").update({ status: "completed" }).in("id", toUpdate.map(b => b.id));
        return { success: true, message: `Marked all ${toUpdate.length} lessons on ${format(targetTime, "MMM do")} as completed.`, actionTaken: "complete_all" };
      }

      const { matches, timeProvided, student } = await findTargetBooking(input);

      if (matches.length === 0) return { success: false, message: `I couldn't find that lesson.` };
      if (matches.length > 1 && !timeProvided) {
        const times = matches.map(m => format(parseISO(m.start_time), "p")).join(", ");
        return { success: false, message: `I found multiple lessons for ${student?.name} on that day (at ${times}). Which one do you mean?` };
      }

      const booking = matches[0];
      
      if (input.includes("paid") || input.includes("settled")) {
        const { data: tx } = await supabase.from("pre_paid_hours_transactions").select("id").eq("booking_id", booking.id).maybeSingle();
        if (tx) return { success: false, message: `This lesson is already covered by pre-paid credit.` };
        await supabase.from("bookings").update({ is_paid: true }).eq("id", booking.id);
        return { success: true, message: `Marked ${booking.title} as paid.`, actionTaken: "paid" };
      }

      if (input.includes("complete") || input.includes("done") || input.includes("finished")) {
        await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id);
        return { success: true, message: `Marked ${booking.title} as completed.`, actionTaken: "complete" };
      }
    }

    // 6. LESSON NOTE PATTERN
    if (input.includes("note") || input.includes("comment") || input.includes("description")) {
      if (input.includes("lesson") || input.includes("booking") || input.includes("slot")) {
        const noteParts = text.split(/[:]|note:|comment:|description:|saying/i);
        const searchArea = noteParts[0].toLowerCase();
        
        const { matches, timeProvided, student } = await findTargetBooking(searchArea);

        if (matches.length > 0) {
          if (matches.length > 1 && !timeProvided) {
            const times = matches.map(m => format(parseISO(m.start_time), "p")).join(", ");
            return { success: false, message: `I found multiple lessons for ${student?.name} on that day (at ${times}). Which one should I add the note to?` };
          }

          const booking = matches[0];
          
          if (noteParts.length > 1 && noteParts[noteParts.length - 1].trim().length > 0) {
            const noteContent = noteParts[noteParts.length - 1].trim();
            await supabase.from("bookings").update({ description: noteContent }).eq("id", booking.id);
            return { success: true, message: `Added note to ${booking.title} on ${format(parseISO(booking.start_time), "MMM do")}.`, actionTaken: "lesson_note" };
          } else {
            return { success: true, message: "What would you like me to add to the notes?", newContext: { pendingNoteForLessonId: booking.id } };
          }
        }
      }
    }

    // 7. LESSON TARGET PATTERN
    if (input.includes("target") || input.includes("goal") || input.includes("objective")) {
      if (input.includes("lesson") || input.includes("booking") || input.includes("slot")) {
        const targetParts = text.split(/[:]|target:|goal:|objective:|saying/i);
        const searchArea = targetParts[0].toLowerCase();
        
        const { matches, timeProvided, student } = await findTargetBooking(searchArea);

        if (matches.length > 0) {
          if (matches.length > 1 && !timeProvided) {
            const times = matches.map(m => format(parseISO(m.start_time), "p")).join(", ");
            return { success: false, message: `I found multiple lessons for ${student?.name} on that day (at ${times}). Which one should I set the target for?` };
          }

          const booking = matches[0];
          
          if (targetParts.length > 1 && targetParts[targetParts.length - 1].trim().length > 0) {
            const targetContent = targetParts[targetParts.length - 1].trim();
            await supabase.from("bookings").update({ targets_for_next_session: targetContent }).eq("id", booking.id);
            return { success: true, message: `Set target for ${booking.title} on ${format(parseISO(booking.start_time), "MMM do")}.`, actionTaken: "lesson_target" };
          } else {
            return { success: true, message: "What target would you like to set for this student?", newContext: { pendingTargetForLessonId: booking.id } };
          }
        }
      }
    }

    // 8. PROGRESS UPDATE PATTERN
    const isProgressUpdate = input.includes("star") || 
                             input.includes("rating") || 
                             input.includes("mark") || 
                             input.includes("progress") ||
                             input.includes("note") ||
                             input.includes("comment") ||
                             input.includes("feedback");

    if (isProgressUpdate) {
      const ratingMatch = input.match(/([1-5])\s*star/i) || input.match(/rating (?:of )?([1-5])/i) || input.match(/mark (?:as )?([1-5])/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;

      let noteContent = null;
      let isPrivate = input.includes("private") || input.includes("instructor note");
      
      const noteParts = text.split(/[:]|note:|comment:|feedback:|saying/i);
      if (noteParts.length > 1) {
        noteContent = noteParts[noteParts.length - 1].trim();
      }

      const searchArea = noteParts[0].toLowerCase();
      const student = students.find(s => searchArea.includes(s.name.toLowerCase()));
      
      const sortedTopics = [...topics].sort((a, b) => b.name.length - a.name.length);
      const topic = sortedTopics.find(t => searchArea.includes(t.name.toLowerCase()));

      if (student && topic) {
        let finalRating = rating;
        if (finalRating === null) {
          const { data: existing } = await supabase
            .from("student_progress_entries")
            .select("rating")
            .eq("student_id", student.id)
            .eq("topic_id", topic.id)
            .order("entry_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          finalRating = existing?.rating || 3;
        }

        await supabase.from("student_progress_entries").insert({
          user_id: userId,
          student_id: student.id,
          topic_id: topic.id,
          rating: finalRating,
          comment: isPrivate ? null : (noteContent || "Updated via Assistant"),
          private_notes: isPrivate ? noteContent : null,
          entry_date: new Date().toISOString()
        });

        let successMsg = `Updated ${student.name}'s ${topic.name}.`;
        if (rating) successMsg += ` Set to ${rating} stars.`;
        if (noteContent) successMsg += ` Added ${isPrivate ? 'private ' : ''}note.`;
        
        return { success: true, message: successMsg, actionTaken: "progress" };
      }
    }

    // 9. BOOKING / SLOT PATTERN
    const isBookingAction = input.includes("book") || input.includes("add") || input.includes("create") || input.includes("set") || input.includes("put");
    const isBookingTarget = input.includes("lesson") || input.includes("slot") || input.includes("gap") || input.includes("space") || input.includes("test") || input.includes("appointment");

    if (isBookingAction && isBookingTarget) {
      let durationMins = 60;
      const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*(hour|hr|min|minute)s?/i);
      if (durationMatch) {
        const val = parseFloat(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        durationMins = (unit.startsWith('h')) ? val * 60 : val;
      }

      let lessonType = "Driving lesson";
      let status = "scheduled";
      let titlePrefix = "";

      if (input.includes("test")) lessonType = "Driving Test";
      else if (input.includes("personal")) lessonType = "Personal";
      else if (
        input.includes("available") || 
        input.includes("availability") || 
        input.includes("gap") || 
        input.includes("space") || 
        input.includes("bookable")
      ) {
        lessonType = "Availability";
        status = "available";
        titlePrefix = "Available Slot";
      }

      const student = students.find(s => input.includes(s.name.toLowerCase()));
      let studentId = student?.id || null;
      let studentName = student?.name || "Someone";

      if (lessonType === "Availability") {
        titlePrefix = "Available Slot";
      } else if (student) {
        titlePrefix = `${student.name} - ${lessonType}`;
      } else if (lessonType === "Personal") {
        titlePrefix = "Personal Appointment";
      } else {
        // If it's not availability or personal, we need a student
        if (!input.includes("available") && !input.includes("gap") && !input.includes("space")) {
          return { success: false, message: "I couldn't find a student with that name in your list." };
        }
        // Fallback for "add a lesson tomorrow" without student name -> assume availability
        lessonType = "Availability";
        status = "available";
        titlePrefix = "Available Slot";
      }

      const { date: startTime } = parseDateTime(input);
      
      // Recurrence Parsing - More strict to avoid catching durations
      let repeatCount = 1;
      let intervalWeeks = 1; 
      
      const isWeekly = input.includes("weekly") || input.includes("every week");
      const isFortnightly = input.includes("fortnightly") || input.includes("every 2 weeks") || input.includes("every two weeks");
      
      // Only consider it repeating if it has explicit keywords OR a specific "for X weeks" pattern
      const repeatMatch = input.match(/(?:repeat|for)\s+(\d+)\s*(?:weeks|times|occurrences)/i);
      const isRepeating = isWeekly || isFortnightly || !!repeatMatch;

      if (isFortnightly) intervalWeeks = 2;
      else if (isWeekly) intervalWeeks = 1;
      else if (!isRepeating) intervalWeeks = 0;

      if (repeatMatch) {
        repeatCount = parseInt(repeatMatch[1]);
        if (intervalWeeks === 0) intervalWeeks = 1;
      } else if (isWeekly || isFortnightly) {
        repeatCount = 4; // Default to 4 weeks if not specified
      }

      const bookingsToInsert = [];
      for (let i = 0; i < repeatCount; i++) {
        const currentStart = addWeeks(startTime, i * intervalWeeks);
        const currentEnd = addMinutes(currentStart, durationMins);
        
        bookingsToInsert.push({
          user_id: userId,
          student_id: studentId,
          title: titlePrefix,
          lesson_type: lessonType,
          start_time: currentStart.toISOString(),
          end_time: currentEnd.toISOString(),
          status: status
        });
      }

      await supabase.from("bookings").insert(bookingsToInsert);
      
      const durationStr = durationMins >= 60 ? `${durationMins / 60} hour(s)` : `${durationMins} mins`;
      let successMsg = `Added a ${durationStr} ${lessonType.toLowerCase()} ${studentId ? 'for ' + studentName : ''} at ${format(startTime, "p")} on ${format(startTime, "MMM do")}.`;
      
      if (lessonType === "Availability") {
        successMsg = `Created a ${durationStr} availability slot at ${format(startTime, "p")} on ${format(startTime, "MMM do")}. Students can now book this space.`;
      }

      if (repeatCount > 1) {
        successMsg = `Created ${repeatCount} ${intervalWeeks === 1 ? 'weekly' : 'fortnightly'} ${durationStr} ${lessonType.toLowerCase()}s starting ${format(startTime, "MMM do")} at ${format(startTime, "p")}.`;
      }

      return { success: true, message: successMsg, actionTaken: "booking" };
    }

    return { 
      success: false, 
      message: "I'm not sure how to do that yet. Try: 'Add a 2 hour availability slot tomorrow at 10am', 'Delete John's lesson at 10am tomorrow', or 'Add £20 fuel expense'." 
    };
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    return { success: false, message: "Internal logic error: " + err.message };
  }
};