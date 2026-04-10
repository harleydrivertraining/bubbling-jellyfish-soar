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
  addYears
} from "date-fns";

export interface AIResponse {
  success: boolean;
  message: string;
  actionTaken?: string;
}

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

    // 3. PROGRESS UPDATE PATTERN (Smarter Entity Matching with Notes)
    const isProgressUpdate = input.includes("star") || 
                             input.includes("rating") || 
                             input.includes("mark") || 
                             input.includes("progress") ||
                             input.includes("note") ||
                             input.includes("comment") ||
                             input.includes("feedback");

    if (isProgressUpdate) {
      // Extract Rating
      const ratingMatch = input.match(/([1-5])\s*star/i) || input.match(/rating (?:of )?([1-5])/i) || input.match(/mark (?:as )?([1-5])/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;

      // Extract Note Content
      let noteContent = null;
      let isPrivate = input.includes("private") || input.includes("instructor note");
      
      // Look for content after a colon or specific keywords
      const noteParts = text.split(/[:]|note:|comment:|feedback:|saying/i);
      if (noteParts.length > 1) {
        noteContent = noteParts[noteParts.length - 1].trim();
      }

      // Find the student mentioned (search in the part BEFORE the note to avoid false matches)
      const searchArea = noteParts[0].toLowerCase();
      const student = students.find(s => searchArea.includes(s.name.toLowerCase()));
      
      // Find the topic mentioned
      const sortedTopics = [...topics].sort((a, b) => b.name.length - a.name.length);
      const topic = sortedTopics.find(t => searchArea.includes(t.name.toLowerCase()));

      if (student && topic) {
        // If no rating was provided, we need to fetch the current rating to avoid overwriting with 0
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
          
          finalRating = existing?.rating || 3; // Default to 3 if never rated
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
        
        return { 
          success: true, 
          message: successMsg, 
          actionTaken: "progress" 
        };
      }
    }

    // 4. BOOKING PATTERN
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

      // Date Parsing
      let targetDate = startOfDay(new Date());
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
            let month = isNaN(parseInt(monthStr)) ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthStr.substring(0, 3)) : parseInt(monthStr) - 1;
            if (month !== -1) {
              targetDate = setMonth(setDate(targetDate, day), month);
              if (isBefore(targetDate, startOfDay(new Date()))) targetDate = addYears(targetDate, 1);
            }
          }
        }
      }

      // Time Parsing
      let startTime = targetDate;
      const timeMatch = input.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3].toLowerCase();
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
        startTime = setHours(setMinutes(targetDate, mins), hours);
      } else {
        startTime = setHours(setMinutes(targetDate, 0), 9);
      }

      const endTime = addMinutes(startTime, durationMins);

      const { error } = await supabase.from("bookings").insert({
        user_id: userId,
        student_id: studentId,
        title: titlePrefix,
        lesson_type: lessonType,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: status
      });

      if (error) return { success: false, message: "Failed to create booking: " + error.message };
      
      const durationStr = durationMins >= 60 ? `${durationMins / 60} hour(s)` : `${durationMins} mins`;
      return { 
        success: true, 
        message: `Booked a ${durationStr} ${lessonType.toLowerCase()} ${studentId ? 'for ' + studentName : ''} at ${format(startTime, "p")} on ${format(startTime, "MMM do")}.`, 
        actionTaken: "booking" 
      };
    }

    return { 
      success: false, 
      message: "I'm not sure how to do that yet. Try: 'Book a 2 hour test for [Name] at 10am on 25th Oct', 'Add £20 fuel expense', or 'Add 5 stars to cockpit drill for [Name]'." 
    };
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    return { success: false, message: "Internal logic error: " + err.message };
  }
};