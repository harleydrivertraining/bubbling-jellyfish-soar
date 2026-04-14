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
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInMinutes
} from "date-fns";

export interface AIResponse {
  success: boolean;
  message: string;
  actionTaken?: string;
  newContext?: any;
}

interface Student {
  id: string;
  name: string;
  auth_user_id: string | null;
}

/**
 * Helper to resolve a student from input string, handling ambiguity
 */
const resolveStudentFromInput = (input: string, students: Student[]) => {
  const cleanInput = input.toLowerCase().trim();
  if (!cleanInput) return { student: null, ambiguous: false };

  // 1. Try exact full name match
  const exactMatches = students.filter(s => s.name.toLowerCase() === cleanInput);
  if (exactMatches.length === 1) return { student: exactMatches[0], ambiguous: false };

  // 2. Try matching full name within the input string
  const sortedStudents = [...students].sort((a, b) => b.name.length - a.name.length);
  const containedMatches = sortedStudents.filter(s => cleanInput.includes(s.name.toLowerCase()));
  if (containedMatches.length === 1) return { student: containedMatches[0], ambiguous: false };
  if (containedMatches.length > 1) return { student: null, ambiguous: true, options: containedMatches };

  // 3. Try matching first name
  const firstNames = students.filter(s => {
    const firstName = s.name.split(' ')[0].toLowerCase();
    const regex = new RegExp(`\\b${firstName}\\b`, 'i');
    return regex.test(cleanInput);
  });

  if (firstNames.length === 1) return { student: firstNames[0], ambiguous: false };
  if (firstNames.length > 1) return { student: null, ambiguous: true, options: firstNames };

  // 4. Fallback: partial match
  const partials = students.filter(s => s.name.toLowerCase().includes(cleanInput));
  if (partials.length === 1) return { student: partials[0], ambiguous: false };
  if (partials.length > 1) return { student: null, ambiguous: true, options: partials };

  return { student: null, ambiguous: false };
};

/**
 * Helper to parse date and time from natural language
 */
const parseDateTime = (input: string): { date: Date; timeProvided: boolean } => {
  const now = new Date();
  let targetDate = startOfDay(now);
  let timeProvided = false;
  
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
      const dateMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\/|\s+)(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
                        input.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
      
      if (dateMatch) {
        let day: number;
        let monthStr: string;

        if (isNaN(parseInt(dateMatch[1]))) {
          monthStr = dateMatch[1].toLowerCase();
          day = parseInt(dateMatch[2]);
        } else {
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

  let finalTime = targetDate;
  const timeMatch = input.match(/(?:at\s+)(\d+)(?::(\d+))?\s*(am|pm)?/i) || 
                    input.match(/(\d+)(?::(\d+))?\s*(am|pm)/i) ||
                    input.match(/(\d+):(\d+)/i);

  if (timeMatch) {
    timeProvided = true;
    let hoursStr = timeMatch[1] || timeMatch[4] || timeMatch[7];
    let minsStr = timeMatch[2] || timeMatch[5] || timeMatch[8];
    let ampm = (timeMatch[3] || timeMatch[6])?.toLowerCase();

    let hours = parseInt(hoursStr);
    const mins = minsStr ? parseInt(minsStr) : 0;
    
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    if (!ampm && !minsStr && hours > 0 && hours < 8) hours += 12; 
    
    finalTime = setHours(setMinutes(targetDate, mins), hours);
  } else {
    finalTime = startOfDay(targetDate);
  }

  return { date: finalTime, timeProvided };
};

export const processAICommand = async (text: string, userId: string, context?: any): Promise<AIResponse> => {
  try {
    const input = text.toLowerCase();

    if (input === "cancel" || input === "stop" || input === "nevermind") {
      return { success: true, message: "Okay, I've cancelled that action.", newContext: null };
    }

    const [studentsRes, topicsRes, carsRes, todosRes] = await Promise.all([
      supabase.from("students").select("id, name, auth_user_id").eq("user_id", userId),
      supabase.from("progress_topics").select("id, name").or(`user_id.eq.${userId},is_default.eq.true`),
      supabase.from("cars").select("id, make, model, initial_mileage").eq("user_id", userId),
      supabase.from("instructor_todos").select("*").eq("user_id", userId)
    ]);

    const students = studentsRes.data || [];
    const topics = topicsRes.data || [];
    const cars = carsRes.data || [];
    const todos = todosRes.data || [];

    // --- CONTEXT HANDLING ---
    if (context?.pendingTodo) {
      const task = text.trim();
      const { error } = await supabase.from("instructor_todos").insert({ user_id: userId, task });
      if (error) return { success: false, message: "Failed to add task: " + error.message };
      return { success: true, message: `Added "**${task}**" to your to do list.`, actionTaken: "add_todo", newContext: null };
    }

    if (context?.pendingBooking) {
      const data = { ...context.pendingBooking };
      const step = data.step;

      if (step === 'student') {
        const { student, ambiguous, options } = resolveStudentFromInput(text, students);
        if (ambiguous) {
          return { 
            success: true, 
            message: `I found multiple students matching that name: **${options.map(o => o.name).join(', ')}**. Which one did you mean?`,
            newContext: context 
          };
        }
        if (!student) return { success: false, message: "I couldn't find a student with that name. Please try again or type 'cancel'.", newContext: context };
        
        data.student_id = student.id;
        data.student_name = student.name;
        data.step = 'date';
        return { success: true, message: `Got it, a lesson for **${student.name}**. What date would you like to make the booking for?`, newContext: { pendingBooking: data } };
      }

      if (step === 'date') {
        const { date } = parseDateTime(input);
        data.date = format(date, "yyyy-MM-dd");
        data.step = 'type_length';
        return { success: true, message: `Understood, for **${format(date, "do MMMM")}**. What lesson type or length is it? (e.g., '1 hour lesson' or '2 hour driving test')`, newContext: { pendingBooking: data } };
      }

      if (step === 'type_length') {
        let durationMins = 60;
        const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*(hour|hr|min|minute)s?/i);
        if (durationMatch) {
          const val = parseFloat(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          durationMins = (unit.startsWith('h')) ? val * 60 : val;
        }

        let lessonType = "Driving lesson";
        if (input.includes("test")) lessonType = "Driving Test";
        else if (input.includes("personal")) lessonType = "Personal";

        data.lesson_type = lessonType;
        data.duration_mins = durationMins;
        data.step = 'time';
        return { success: true, message: `Okay, a **${durationMins >= 60 ? (durationMins/60) + ' hour' : durationMins + ' min'} ${lessonType.toLowerCase()}**. And what time would you like the booking to start?`, newContext: { pendingBooking: data } };
      }

      if (step === 'time') {
        const { date, timeProvided } = parseDateTime(input);
        if (!timeProvided) return { success: false, message: "I didn't catch a specific time. Could you please tell me what time the lesson starts?", newContext: context };
        
        const finalStart = new Date(data.date);
        finalStart.setHours(date.getHours());
        finalStart.setMinutes(date.getMinutes());
        const finalEnd = addMinutes(finalStart, data.duration_mins);

        const { error } = await supabase.from("bookings").insert({
          user_id: userId,
          student_id: data.student_id,
          title: `${data.student_name} - ${data.lesson_type}`,
          lesson_type: data.lesson_type,
          start_time: finalStart.toISOString(),
          end_time: finalEnd.toISOString(),
          status: "scheduled"
        });

        if (error) return { success: false, message: "Failed to create booking: " + error.message };
        return { success: true, message: `Success! I've booked a **${data.lesson_type}** for **${data.student_name}** on **${format(finalStart, "do MMMM")}** at **${format(finalStart, "p")}**.`, actionTaken: "booking", newContext: null };
      }
    }

    // --- TO DO LIST PATTERNS ---
    const isTodoKeyword = input.includes("task") || input.includes("todo") || input.includes("to-do") || input.includes("reminder") || input.includes("remind") || input.includes("forget");
    
    // Add Todo
    if ((input.includes("add") || input.includes("remind") || input.includes("forget") || input.includes("put") || input.includes("new")) && isTodoKeyword) {
      let task = null;
      
      const remindMatch = text.match(/(?:remind me to|don't forget to|do not forget to|remind me|reminder to)\s+(.+)/i);
      const addMatch = text.match(/(?:add|put|create)(?:\s+a)?(?:\s+new)?(?:\s+task|\s+todo|\s+to-do|\s+reminder)?(?:\s+called|\s+named|:)?\s+(.+?)(?:\s+to my|\s+on my|\s+in my|$)/i);
      
      if (remindMatch) task = remindMatch[1].trim();
      else if (addMatch) task = addMatch[1].trim();

      if (task) {
        task = task.replace(/(?:to|on|in)\s+(?:my\s+)?(?:todo|to-do|task|list|reminders?)$/i, "").trim();
        
        // If the captured task is just one of the keywords, it means the user didn't provide a task name
        const keywords = ["task", "todo", "to-do", "reminder", "reminders"];
        if (keywords.includes(task.toLowerCase())) {
          task = null;
        }
      }

      if (task) {
        const { error } = await supabase.from("instructor_todos").insert({ user_id: userId, task });
        if (error) return { success: false, message: "Failed to add task: " + error.message };
        return { success: true, message: `Added "**${task}**" to your to do list.`, actionTaken: "add_todo" };
      } else {
        // If they just said "add a new task" without content
        return { success: true, message: "Sure! What task would you like to add to your list?", newContext: { pendingTodo: { step: 'task' } } };
      }
    }

    // Complete Todo
    if ((input.includes("complete") || input.includes("finish") || input.includes("mark") || input.includes("set")) && isTodoKeyword) {
      const searchArea = input.replace(/complete|finish|mark|set|task|todo|to-do|reminder|as|done|completed|finished/g, "").trim();
      if (searchArea) {
        const matchedTodo = todos.find(t => t.task.toLowerCase().includes(searchArea));
        if (matchedTodo) {
          const { error } = await supabase.from("instructor_todos").update({ completed: true }).eq("id", matchedTodo.id);
          if (error) return { success: false, message: "Failed to update task." };
          return { success: true, message: `Marked "**${matchedTodo.task}**" as completed.`, actionTaken: "complete_todo" };
        }
      }
    }

    // Delete Todo
    if ((input.includes("delete") || input.includes("remove")) && isTodoKeyword) {
      if (input.includes("all") || input.includes("everything") || input.includes("list")) {
        const { error } = await supabase.from("instructor_todos").delete().eq("user_id", userId);
        if (error) return { success: false, message: "Failed to clear your list." };
        return { success: true, message: "I've cleared all tasks from your to do list.", actionTaken: "clear_todos" };
      }

      const searchArea = input.replace(/delete|remove|task|todo|to-do|reminder/g, "").trim();
      if (searchArea) {
        const matchedTodo = todos.find(t => t.task.toLowerCase().includes(searchArea));
        if (matchedTodo) {
          const { error } = await supabase.from("instructor_todos").delete().eq("id", matchedTodo.id);
          if (error) return { success: false, message: "Failed to delete task." };
          return { success: true, message: `Removed "**${matchedTodo.task}**" from your list.`, actionTaken: "delete_todo" };
        }
      }
    }

    // List Todos
    if ((input.includes("what") || input.includes("show") || input.includes("list")) && (input.includes("tasks") || input.includes("todo") || input.includes("to-do") || input.includes("reminders"))) {
      const active = todos.filter(t => !t.completed);
      if (active.length === 0) return { success: true, message: "Your to do list is empty! You're all caught up." };
      const list = active.map((t, i) => `${i + 1}. ${t.task}`).join("\n");
      return { success: true, message: `Here are your active tasks:\n\n${list}`, actionTaken: "list_todos" };
    }

    // --- OTHER PATTERNS (STUDENTS, EXPENSES, ETC) ---
    const isStudentKeyword = input.includes("student") || input.includes("learner") || input.includes("pupil");
    if (input.includes("add") && isStudentKeyword) {
      const nameMatch = text.match(/add (?:a )?new (?:student|learner|pupil) (?:called |named )?([a-z\s]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : null;
      return { success: true, message: name ? `Sure! I'll help you add **${name}**. What is their date of birth?` : "Sure! I can help you add a new student. What is the student's name?", newContext: { pendingStudent: { step: name ? 'dob' : 'name', name: name } } };
    }

    const expenseMatch = input.match(/add (?:£|\$)?(\d+(?:\.\d+)?) (\w+) expense(?: (.+))?/i);
    if (expenseMatch) {
      const [_, amount, category, description] = expenseMatch;
      const { error } = await supabase.from("expenditures").insert({ user_id: userId, amount: parseFloat(amount), category: category.charAt(0).toUpperCase() + category.slice(1), description: description || `AI Added: ${category}`, date: format(new Date(), "yyyy-MM-dd") });
      if (error) return { success: false, message: "Failed to add expense: " + error.message };
      return { success: true, message: `Added £${amount} expense for ${category}.`, actionTaken: "expense" };
    }

    const mileageValueMatch = input.match(/(\d+(?:\.\d+)?)/); 
    const hasMileageKeyword = input.includes("mileage") || input.includes("miles") || input.includes("odo");
    if (mileageValueMatch && hasMileageKeyword) {
      const value = parseFloat(mileageValueMatch[1]);
      if (cars.length === 0) return { success: false, message: "You haven't added any cars to your mileage tracker yet." };
      let targetCar = cars[0]; 
      const matchedCar = cars.find(c => input.includes(c.make.toLowerCase()) || input.includes(c.model.toLowerCase()));
      if (matchedCar) targetCar = matchedCar;
      const isAdditive = input.includes("add") || input.includes("plus") || input.includes("driven") || input.includes("did") || (value < 1000 && !input.includes("set") && !input.includes("is"));
      let finalMileage = value;
      if (isAdditive) {
        const { data: latestEntry } = await supabase.from("car_mileage_entries").select("current_mileage").eq("car_id", targetCar.id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
        finalMileage = (latestEntry?.current_mileage || targetCar.initial_mileage) + value;
      }
      const { error } = await supabase.from("car_mileage_entries").insert({ user_id: userId, car_id: targetCar.id, current_mileage: finalMileage, entry_date: format(new Date(), "yyyy-MM-dd"), notes: isAdditive ? `Added ${value} miles via AI` : "Updated total via AI" });
      if (error) return { success: false, message: "Failed to record mileage: " + error.message };
      return { success: true, message: isAdditive ? `Added ${value} miles to your ${targetCar.make}. New total is ${finalMileage.toFixed(0)}.` : `Updated total mileage for your ${targetCar.make} to ${finalMileage.toFixed(0)}.`, actionTaken: "mileage" };
    }

    if (input.includes("next") && (input.includes("lesson") || input.includes("booking") || input.includes("schedule") || input.includes("who"))) {
      const { data: nextBooking } = await supabase.from("bookings").select("id, title, start_time, lesson_type, students(name)").eq("user_id", userId).eq("status", "scheduled").gt("start_time", new Date().toISOString()).order("start_time", { ascending: true }).limit(1).maybeSingle();
      if (!nextBooking) return { success: true, message: "You don't have any more lessons scheduled for today or in the future." };
      const startTime = parseISO(nextBooking.start_time);
      const studentName = (nextBooking.students as any)?.name || "a student";
      const dateStr = isToday(startTime) ? "today" : isSameDay(startTime, startOfTomorrow()) ? "tomorrow" : `on ${format(startTime, "EEEE, MMM do")}`;
      return { success: true, message: `Your next lesson is with **${studentName}** at **${format(startTime, "p")}** ${dateStr}. It's a **${nextBooking.lesson_type}**.`, actionTaken: "query_next_lesson" };
    }

    const isBookingAction = input.includes("book") || input.includes("add") || input.includes("create") || input.includes("set") || input.includes("put");
    const isBookingTarget = input.includes("lesson") || input.includes("slot") || input.includes("gap") || input.includes("space") || input.includes("test") || input.includes("appointment");
    if (isBookingAction && isBookingTarget) {
      const { student, ambiguous, options } = resolveStudentFromInput(input, students);
      const { date: startTime, timeProvided } = parseDateTime(input);
      if (ambiguous) return { success: true, message: `I found multiple students matching that name: **${options.map(o => o.name).join(', ')}**. Which one did you mean?`, newContext: { pendingBooking: { step: 'student', date: format(startTime, "yyyy-MM-dd"), start_time: startTime.toISOString() } } };
      if (!student && !timeProvided && !input.includes("available")) return { success: true, message: "Sure! I can help you book a lesson. What is the student's name?", newContext: { pendingBooking: { step: 'student' } } };
      if (!student && !input.includes("available")) return { success: true, message: "I've got the time, but who is the lesson for?", newContext: { pendingBooking: { step: 'student', date: format(startTime, "yyyy-MM-dd"), start_time: startTime.toISOString() } } };
      let durationMins = 60;
      const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*(hour|hr|min|minute)s?/i);
      if (durationMatch) { const val = parseFloat(durationMatch[1]); const unit = durationMatch[2].toLowerCase(); durationMins = (unit.startsWith('h')) ? val * 60 : val; }
      let lessonType = "Driving lesson";
      let status = "scheduled";
      let titlePrefix = "";
      if (input.includes("test")) { lessonType = "Driving Test"; if (!durationMatch) durationMins = 120; }
      else if (input.includes("personal")) lessonType = "Personal";
      else if (input.includes("available") || input.includes("availability") || input.includes("gap") || input.includes("space")) { lessonType = "Availability"; status = "available"; titlePrefix = "Available Slot"; }
      if (lessonType === "Availability") titlePrefix = "Available Slot";
      else if (student) titlePrefix = `${student.name} - ${lessonType}`;
      else if (lessonType === "Personal") titlePrefix = "Personal Appointment";
      if (!timeProvided && !input.includes("available")) return { success: true, message: `I've got the student, but what date and time would you like to book for **${student?.name || 'Someone'}**?`, newContext: { pendingBooking: { step: 'date', student_id: student?.id, student_name: student?.name, lesson_type: lessonType, duration_mins: durationMins } } };
      await supabase.from("bookings").insert({ user_id: userId, student_id: student?.id || null, title: titlePrefix, lesson_type: lessonType, start_time: startTime.toISOString(), end_time: addMinutes(startTime, durationMins).toISOString(), status: status });
      return { success: true, message: `Added a ${durationMins >= 60 ? (durationMins/60) + ' hour' : durationMins + ' min'} ${lessonType.toLowerCase()} ${student ? 'for ' + student.name : ''} at ${format(startTime, "p")} on ${format(startTime, "MMM do")}.`, actionTaken: "booking" };
    }

    return { 
      success: false, 
      message: "I'm not sure how to do that yet. Try: 'Remind me to call John', 'Add £20 fuel expense', or 'Book a lesson for Sarah tomorrow at 10am'." 
    };
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    return { success: false, message: "Internal logic error: " + err.message };
  }
};