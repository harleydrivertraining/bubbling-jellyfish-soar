import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parse, isValid, startOfTomorrow, setHours, setMinutes, addMinutes } from "date-fns";

export interface AIResponse {
  success: boolean;
  message: string;
  actionTaken?: string;
}

/**
 * This is a 'Smart Parser'. In a production app, you would send the text 
 * to an OpenAI/Claude API via a Supabase Edge Function. 
 * For now, this handles common patterns locally.
 */
export const processAICommand = async (text: string, userId: string): Promise<AIResponse> => {
  try {
    const input = text.toLowerCase();

    // 1. ADD EXPENSE PATTERN: "add [amount] [category] expense [description]"
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

    // 2. BOOKING PATTERN: "book [duration] [type] for [student] at [time] [day]"
    // Examples: 
    // "book 2 hours for john at 10am tomorrow"
    // "book a 90 min test for sarah at 1pm"
    // "book personal time at 3pm"
    if (input.includes("book")) {
      // Determine Duration (default 60 mins)
      let durationMins = 60;
      const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*(hour|hr|min|minute)s?/i);
      if (durationMatch) {
        const val = parseFloat(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        durationMins = (unit.startsWith('h')) ? val * 60 : val;
      }

      // Determine Lesson Type
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

      // Find Student (if not availability/personal)
      let studentId = null;
      let studentName = "Someone";

      if (lessonType !== "Availability") {
        const { data: students } = await supabase.from("students").select("id, name").eq("user_id", userId);
        const student = students?.find(s => input.includes(s.name.toLowerCase()));
        
        if (student) {
          studentId = student.id;
          studentName = student.name;
          titlePrefix = `${student.name} - ${lessonType}`;
        } else if (lessonType !== "Personal") {
          return { success: false, message: "I couldn't find a student with that name in your list." };
        } else {
          titlePrefix = "Personal Appointment";
        }
      }

      // Determine Start Time
      let startTime = new Date();
      if (input.includes("tomorrow")) startTime = startOfTomorrow();
      
      const timeMatch = input.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3].toLowerCase();
        
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
        
        startTime = setHours(setMinutes(startTime, mins), hours);
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

    // 3. PROGRESS PATTERN: "mark [student] [rating] stars for [topic]"
    const progressMatch = input.match(/mark (\w+ \w+|\w+) (\d) stars? for (.+)/i);
    if (progressMatch) {
      const [_, studentName, rating, topicName] = progressMatch;
      
      const { data: students } = await supabase.from("students").select("id, name").eq("user_id", userId);
      const student = students?.find(s => s.name.toLowerCase().includes(studentName.toLowerCase()));
      
      const { data: topics } = await supabase.from("progress_topics").select("id, name").or(`user_id.eq.${userId},is_default.eq.true`);
      const topic = topics?.find(t => t.name.toLowerCase().includes(topicName.toLowerCase()));

      if (!student || !topic) return { success: false, message: `I couldn't find ${!student ? 'that student' : 'that topic'}.` };

      const { error } = await supabase.from("student_progress_entries").insert({
        user_id: userId,
        student_id: student.id,
        topic_id: topic.id,
        rating: parseInt(rating),
        comment: "Added via Instructor Assistant",
        entry_date: new Date().toISOString()
      });

      if (error) return { success: false, message: "Failed to save progress: " + error.message };
      return { success: true, message: `Updated ${student.name}'s progress for ${topic.name} to ${rating} stars.`, actionTaken: "progress" };
    }

    return { 
      success: false, 
      message: "I'm not sure how to do that yet. Try: 'Book a 2 hour test for [Name] at 10am tomorrow' or 'Add £20 fuel expense'." 
    };
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    return { success: false, message: "Internal logic error: " + err.message };
  }
};