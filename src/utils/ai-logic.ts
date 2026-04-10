import { supabase } from "@/integrations/supabase/client";
import { 
  format, 
  addDays, 
  startOfTomorrow, 
  setHours, 
  setMinutes, 
  addMinutes, 
  nextDay, 
  parse, 
  isValid, 
  setMonth, 
  setDate,
  startOfDay,
  isBefore,
  addYears,
  parseISO,
  addWeeks
} from "date-fns";

export interface AIResponse {
  success: boolean;
  message: string;
  actionTaken?: string;
}

/**
 * Helper to parse date and time from natural language
 */
const parseDateTime = (input: string): Date => {
  let targetDate = startOfDay(new Date());
  
  // Date Parsing
  if (input.includes("tomorrow")) {
    targetDate = startOfTomorrow();
  } else {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayIndex = days.findIndex(d => input.includes(d));
    if (dayIndex !== -1) {
      targetDate = nextDay(new Date(), dayIndex as any);
    } else {
      const dateMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\/|\s+)(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const monthStr = dateMatch[2].toLowerCase();
        let month = isNaN(parseInt(monthStr)) 
          ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthStr.substring(0, 3)) 
          : parseInt(monthStr) - 1;
        
        if (month !== -1) {
          targetDate = setMonth(setDate(targetDate, day), month);
          if (isBefore(targetDate, startOfDay(new Date()))) targetDate = addYears(targetDate, 1);
        }
      }
    }
  }

  // Time Parsing
  let finalTime = targetDate;
  const timeMatch = input.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    finalTime = setHours(setMinutes(targetDate, mins), hours);
  } else {
    // Default to 9am if no time specified
    finalTime = setHours(setMinutes(targetDate, 0), 9);
  }

  return finalTime;
};

/**
 * This is a 'Smart Parser'. It scans the input for known entities (students, topics)
 * and patterns (amounts, dates, times) to perform actions.
 */
export const processAICommand = async (text: string, userId: string): Promise<AIResponse> => {
  try {
    const input = text.toLowerCase();

    // 1. FETCH ENTITIES FIRST (Students and Topics)
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

    // 3. DELETE/CANCEL BOOKING PATTERN
    if (input.includes("delete") || input.includes("cancel") || input.includes("remove")) {
      if (input.includes("booking") || input.includes("lesson") || input.includes("slot") || input.includes("test")) {
        const targetTime = parseDateTime(input);
        const student = students.find(s => input.includes(s.name.toLowerCase()));
        
        let query = supabase
          .from("bookings")
          .select("id, title, start_time")
          .eq("user_id", userId)
          .eq("start_time", targetTime.toISOString());

        if (student) {
          query = query.eq("student_id", student.id);
        }

        const { data: matches, error: fetchError } = await query;

        if (fetchError) return { success: false, message: "Error finding booking: " + fetchError.message };
        
        if (!matches || matches.length === 0) {
          return { 
            success: false, 
            message: `I couldn't find a booking at ${format(targetTime, "p")} on ${format(targetTime, "MMM do")}${student ? ' for ' + student.name : ''}.` 
          };
        }

        // Delete the first match
        const bookingToDelete = matches[0];
        const { error: deleteError } = await supabase
          .from("bookings")
          .delete()
          .eq("id", bookingToDelete.id);

        if (deleteError) return { success: false, message: "Failed to delete: " + deleteError.message };

        return { 
          success: true, 
          message: `Successfully deleted the booking: "${bookingToDelete.title}" at ${format(targetTime, "p")} on ${format(targetTime, "MMM do")}.`,
          actionTaken: "delete_booking"
        };
      }
    }

    // 4. UPDATE BOOKING STATUS (Complete/Paid)
    const isStatusUpdate = input.includes("complete") || 
                           input.includes("done") || 
                           input.includes("finished") || 
                           input.includes("paid") || 
                           input.includes("settled");

    if (isStatusUpdate) {
      const targetTime = parseDateTime(input);
      const student = students.find(s => input.includes(s.name.toLowerCase()));
      
      let query = supabase
        .from("bookings")
        .select("id, title, start_time, is_paid")
        .eq("user_id", userId)
        .eq("start_time", targetTime.toISOString());

      if (student) {
        query = query.eq("student_id", student.id);
      }

      const { data: matches } = await query;

      if (!matches || matches.length === 0) {
        return { 
          success: false, 
          message: `I couldn't find a booking at ${format(targetTime, "p")} on ${format(targetTime, "MMM do")}${student ? ' for ' + student.name : ''}.` 
        };
      }

      const booking = matches[0];
      
      if (input.includes("paid") || input.includes("settled")) {
        // Check if covered by pre-paid credit
        const { data: tx } = await supabase
          .from("pre_paid_hours_transactions")
          .select("id")
          .eq("booking_id", booking.id)
          .maybeSingle();
        
        if (tx) {
          return { success: false, message: `This lesson for ${student?.name || 'the student'} is already covered by pre-paid credit, so it doesn't need to be marked as paid.` };
        }

        const { error } = await supabase.from("bookings").update({ is_paid: true }).eq("id", booking.id);
        if (error) return { success: false, message: "Failed to mark as paid: " + error.message };
        return { success: true, message: `Marked ${booking.title} as paid.`, actionTaken: "paid" };
      }

      if (input.includes("complete") || input.includes("done") || input.includes("finished")) {
        const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id);
        if (error) return { success: false, message: "Failed to mark as complete: " + error.message };
        return { success: true, message: `Marked ${booking.title} as completed.`, actionTaken: "complete" };
      }
    }

    // 5. PROGRESS UPDATE PATTERN
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

        const { error } = await supabase.from("student_progress_entries").insert({
          user_id: userId,
          student_id: student.id,
          topic_id: topic.id,
          rating: finalRating,
          comment: isPrivate ? null : (noteContent || "Updated via Assistant"),
          private_notes: isPrivate ? noteContent : null,
          entry_date: new Date().toISOString()
        });

        if (error) return { success: false, message: "Failed to save progress: " + error.message };
        
        let successMsg = `Updated ${student.name}'s ${topic.name}.`;
        if (rating) successMsg += ` Set to ${rating} stars.`;
        if (noteContent) successMsg += ` Added ${isPrivate ? 'private ' : ''}note.`;
        
        return { success: true, message: successMsg, actionTaken: "progress" };
      }
    }

    // 6. BOOKING PATTERN
    if (input.includes("book")) {
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
      else if (input.includes("available") || input.includes("availability")) {
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
        return { success: false, message: "I couldn't find a student with that name in your list." };
      }

      const startTime = parseDateTime(input);
      
      // Recurrence Parsing
      let repeatCount = 1;
      let intervalWeeks = 0;
      
      if (input.includes("weekly") || input.includes("every week")) {
        intervalWeeks = 1;
      } else if (input.includes("fortnightly") || input.includes("every 2 weeks") || input.includes("every two weeks")) {
        intervalWeeks = 2;
      }

      const repeatMatch = input.match(/(?:for|repeat)\s+(\d+)\s*(?:weeks|times|occurrences)?/i);
      if (repeatMatch) {
        repeatCount = parseInt(repeatMatch[1]);
      } else if (intervalWeeks > 0) {
        // Default to 4 repeats if interval specified but no count
        repeatCount = 4;
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

      const { error } = await supabase.from("bookings").insert(bookingsToInsert);

      if (error) return { success: false, message: "Failed to create booking(s): " + error.message };
      
      const durationStr = durationMins >= 60 ? `${durationMins / 60} hour(s)` : `${durationMins} mins`;
      let successMsg = `Booked a ${durationStr} ${lessonType.toLowerCase()} ${studentId ? 'for ' + studentName : ''} at ${format(startTime, "p")} on ${format(startTime, "MMM do")}.`;
      
      if (repeatCount > 1) {
        successMsg = `Booked ${repeatCount} ${intervalWeeks === 1 ? 'weekly' : 'fortnightly'} ${durationStr} ${lessonType.toLowerCase()}s ${studentId ? 'for ' + studentName : ''} starting ${format(startTime, "MMM do")} at ${format(startTime, "p")}.`;
      }

      return { 
        success: true, 
        message: successMsg, 
        actionTaken: "booking" 
      };
    }

    return { 
      success: false, 
      message: "I'm not sure how to do that yet. Try: 'Delete John's lesson at 10am tomorrow', 'Add £20 fuel expense', or 'Add 5 stars to cockpit drill for [Name]'." 
    };
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    return { success: false, message: "Internal logic error: " + err.message };
  }
};