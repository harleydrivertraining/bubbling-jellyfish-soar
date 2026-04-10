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

/**
 * This is a 'Smart Parser'. It scans the input for known entities (students, topics)
 * and patterns (amounts, dates, times) to perform actions.
 */
export const processAICommand = async (text: string, userId: string, context?: any): Promise<AIResponse> => {
  try {
    const input = text.toLowerCase();

    // 0. GLOBAL CANCEL
    if (input === "cancel" || input === "stop" || input === "nevermind") {
      return { success: true, message: "Okay, I've cancelled that action.", newContext: null };
    }

    // 1. FETCH ENTITIES
    const [studentsRes, topicsRes, carsRes] = await Promise.all([
      supabase.from("students").select("id, name, auth_user_id").eq("user_id", userId),
      supabase.from("progress_topics").select("id, name").or(`user_id.eq.${userId},is_default.eq.true`),
      supabase.from("cars").select("id, make, model, initial_mileage").eq("user_id", userId)
    ]);

    const students = studentsRes.data || [];
    const topics = topicsRes.data || [];
    const cars = carsRes.data || [];

    // 2. CHECK CONTEXT FOR PENDING ACTIONS
    
    // --- GUIDED BOOKING FLOW ---
    if (context?.pendingBooking) {
      const data = { ...context.pendingBooking };
      const step = data.step;

      if (step === 'student') {
        const student = students.find(s => input.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(input));
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
        
        // Combine the previously stored date with the new time
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
        
        return { 
          success: true, 
          message: `Success! I've booked a **${data.lesson_type}** for **${data.student_name}** on **${format(finalStart, "do MMMM")}** at **${format(finalStart, "p")}**.`, 
          actionTaken: "booking",
          newContext: null 
        };
      }
    }

    // --- GUIDED PRE-PAID HOURS FLOW ---
    if (context?.pendingPrePaidHours) {
      const data = { ...context.pendingPrePaidHours };
      const step = data.step;

      if (step === 'student') {
        const student = students.find(s => input.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(input));
        if (!student) return { success: false, message: "I couldn't find a student with that name. Please try again or type 'cancel'.", newContext: context };
        data.student_id = student.id;
        data.student_name = student.name;
        data.step = 'amount';
        return { success: true, message: `Got it, adding hours for **${student.name}**. How many would you like to add?`, newContext: { pendingPrePaidHours: data } };
      }

      if (step === 'amount') {
        const amountMatch = input.match(/(\d+(?:\.\d+)?)/);
        if (!amountMatch) return { success: false, message: "I didn't catch the number of hours. How many would you like to add?", newContext: context };
        const hours = parseFloat(amountMatch[1]);
        
        const { error } = await supabase.from("pre_paid_hours").insert({
          user_id: userId,
          student_id: data.student_id,
          package_hours: hours,
          remaining_hours: hours,
          purchase_date: format(new Date(), "yyyy-MM-dd"),
          notes: "Added via AI Assistant"
        });

        if (error) return { success: false, message: "Failed to add hours: " + error.message };
        return { 
          success: true, 
          message: `Success! I've added **${hours} hours** of credit to **${data.student_name}**'s account.`, 
          actionTaken: "add_prepaid_hours",
          newContext: null 
        };
      }
    }

    // --- MARK PAST STUDENT FLOW ---
    if (context?.pendingMarkPastStudent) {
      const student = students.find(s => input.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(input));
      if (!student) return { success: false, message: "I couldn't find a student with that name. Please try again or type 'cancel'.", newContext: context };
      
      const { error } = await supabase.from("students").update({ is_past_student: true }).eq("id", student.id);
      if (error) return { success: false, message: "Failed to update student: " + error.message };
      
      return { 
        success: true, 
        message: `Success! **${student.name}** has been marked as a past student.`, 
        actionTaken: "mark_past_student",
        newContext: null 
      };
    }

    // --- NEW STUDENT FLOW ---
    if (context?.pendingStudent) {
      const data = { ...context.pendingStudent };
      const step = data.step;

      if (step === 'name') {
        data.name = text.trim();
        data.step = 'dob';
        return { success: true, message: `Got it. What is **${data.name}**'s date of birth?`, newContext: { pendingStudent: data } };
      }

      if (step === 'dob') {
        const dobMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\/|\s+)(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\/|\s+)(\d{2,4})/i);
        if (dobMatch) {
          const day = parseInt(dobMatch[1]);
          const monthStr = dobMatch[2].toLowerCase();
          const yearStr = dobMatch[3];
          const year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
          const month = isNaN(parseInt(monthStr)) 
            ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthStr.substring(0, 3)) 
            : parseInt(monthStr) - 1;
          
          if (month !== -1) {
            data.date_of_birth = format(new Date(year, month, day), "yyyy-MM-dd");
          }
        } else if (text.includes("skip") || text.includes("don't know") || text.includes("none")) {
          data.date_of_birth = null;
        } else {
          return { success: false, message: "I couldn't quite catch that date. Please use a format like DD/MM/YYYY or '15th March 2000'. You can also type 'skip'.", newContext: context };
        }
        data.step = 'license';
        return { success: true, message: "What is their driving license number?", newContext: { pendingStudent: data } };
      }

      if (step === 'license') {
        data.driving_license_number = (text.includes("skip") || text.includes("none")) ? null : text.trim().toUpperCase();
        data.step = 'phone';
        return { success: true, message: "What is their phone number?", newContext: { pendingStudent: data } };
      }

      if (step === 'phone') {
        data.phone_number = (text.includes("skip") || text.includes("none")) ? null : text.trim();
        data.step = 'address';
        return { success: true, message: "What is their address?", newContext: { pendingStudent: data } };
      }

      if (step === 'address') {
        data.full_address = (text.includes("skip") || text.includes("none")) ? null : text.trim();
        data.step = 'notes';
        return { success: true, message: "Would you like to add any notes for this student?", newContext: { pendingStudent: data } };
      }

      if (step === 'notes') {
        data.notes = (text.includes("skip") || text.includes("none") || text.includes("no")) ? null : text.trim();
        
        const { error } = await supabase.from("students").insert({
          user_id: userId,
          name: data.name,
          date_of_birth: data.date_of_birth,
          driving_license_number: data.driving_license_number,
          phone_number: data.phone_number,
          full_address: data.full_address,
          notes: data.notes,
          status: "Beginner"
        });

        if (error) return { success: false, message: "Failed to add student: " + error.message };
        return { 
          success: true, 
          message: `Success! **${data.name}** has been added to your student list.`, 
          actionTaken: "add_student",
          newContext: null 
        };
      }
    }

    if (context?.pendingNoteForLessonId) {
      const { data: booking, error: fetchError } = await supabase.from("bookings").select("id, title").eq("id", context.pendingNoteForLessonId).single();
      if (!fetchError && booking) {
        await supabase.from("bookings").update({ description: text.trim() }).eq("id", booking.id);
        return { success: true, message: `Got it. I've added that note to ${booking.title}.`, actionTaken: "lesson_note_followup", newContext: null };
      }
    }

    if (context?.pendingTargetForLessonId) {
      const { data: booking, error: fetchError } = await supabase.from("bookings").select("id, title").eq("id", context.pendingTargetForLessonId).single();
      if (!fetchError && booking) {
        await supabase.from("bookings").update({ targets_for_next_session: text.trim() }).eq("id", booking.id);
        return { success: true, message: `Got it. I've set that target for ${booking.title}.`, actionTaken: "lesson_target_followup", newContext: null };
      }
    }

    // --- TEST RESULT FLOW ---
    if (context?.pendingTestResult) {
      const data = { ...context.pendingTestResult };
      const step = data.step;

      if (step === 'student') {
        const student = students.find(s => input.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(input));
        if (!student) return { success: false, message: "I couldn't find a student with that name. Please try again or type 'cancel'.", newContext: context };
        data.student_id = student.id;
        data.student_name = student.name;
        data.step = 'date';
        return { success: true, message: `Got it, ${student.name}. What date was the test?`, newContext: { pendingTestResult: data } };
      }

      if (step === 'date') {
        const { date } = parseDateTime(input);
        data.test_date = format(date, "yyyy-MM-dd");
        data.step = 'outcome';
        return { success: true, message: `And did they pass?`, newContext: { pendingTestResult: data } };
      }

      if (step === 'outcome') {
        const passed = input.includes("yes") || input.includes("pass") || input.includes("yeah");
        data.passed = passed;
        if (passed) {
          data.step = 'faults';
          return { success: true, message: `Great! How many driving faults did they have?`, newContext: { pendingTestResult: data } };
        } else {
          data.step = 'interaction';
          return { success: true, message: `Sorry to hear that. Was there any examiner interaction (intervention)?`, newContext: { pendingTestResult: data } };
        }
      }

      if (step === 'interaction') {
        data.examiner_action = input.includes("yes") || input.includes("yeah") || input.includes("did");
        data.step = 'serious';
        return { success: true, message: `How many serious faults were recorded?`, newContext: { pendingTestResult: data } };
      }

      if (step === 'serious') {
        const val = parseInt(input.match(/\d+/)?.[0] || "0");
        data.serious_faults = val;
        data.step = 'faults';
        return { success: true, message: `And how many driving faults?`, newContext: { pendingTestResult: data } };
      }

      if (step === 'faults') {
        const val = parseInt(input.match(/\d+/)?.[0] || "0");
        data.driving_faults = val;
        
        const { error } = await supabase.from("driving_tests").insert({
          user_id: userId,
          student_id: data.student_id,
          test_date: data.test_date,
          passed: data.passed,
          driving_faults: data.driving_faults,
          serious_faults: data.serious_faults || 0,
          examiner_action: data.examiner_action || false,
          notes: `Recorded via AI Assistant conversation.`
        });

        if (error) return { success: false, message: "Failed to save: " + error.message };
        return { 
          success: true, 
          message: `Test result recorded for **${data.student_name}**! Result: **${data.passed ? 'PASSED' : 'FAILED'}** with ${data.driving_faults} driving faults.`,
          actionTaken: "test_result",
          newContext: null
        };
      }
    }

    // 4. ADD STUDENT PATTERN
    if (input.includes("add") && input.includes("student")) {
      const nameMatch = text.match(/add (?:a )?new student (?:called |named )?([a-z\s]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : null;

      return {
        success: true,
        message: name ? `Sure! I'll help you add **${name}**. What is their date of birth?` : "Sure! I can help you add a new student. What is the student's name?",
        newContext: {
          pendingStudent: {
            step: name ? 'dob' : 'name',
            name: name
          }
        }
      };
    }

    // 5. MARK PAST STUDENT PATTERN
    const isMarkPastAction = input.includes("mark") || input.includes("set") || input.includes("archive") || input.includes("finished") || input.includes("done with");
    const isPastStudentTarget = input.includes("past student") || input.includes("archive") || input.includes("finished student");
    
    if (isMarkPastAction && isPastStudentTarget) {
      const cleanInput = input.replace("past student", "").replace("archive", "").replace("mark", "").replace("set", "").trim();
      const student = students.find(s => cleanInput.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleanInput) && cleanInput.length > 2);
      
      if (student) {
        const { error } = await supabase.from("students").update({ is_past_student: true }).eq("id", student.id);
        if (error) return { success: false, message: "Failed to update student: " + error.message };
        return { success: true, message: `Success! **${student.name}** has been marked as a past student.`, actionTaken: "mark_past_student" };
      } else {
        return { 
          success: true, 
          message: "Which student would you like to mark as a past student?", 
          newContext: { pendingMarkPastStudent: true } 
        };
      }
    }

    // 6. ADD EXPENSE PATTERN
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

    // 7. MILEAGE ENTRY PATTERN
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
        const currentTotal = latestEntry?.current_mileage || targetCar.initial_mileage;
        finalMileage = currentTotal + value;
      }

      const { error } = await supabase.from("car_mileage_entries").insert({
        user_id: userId,
        car_id: targetCar.id,
        current_mileage: finalMileage,
        entry_date: format(new Date(), "yyyy-MM-dd"),
        notes: isAdditive ? `Added ${value} miles via AI` : "Updated total via AI"
      });

      if (error) return { success: false, message: "Failed to record mileage: " + error.message };
      return { success: true, message: isAdditive ? `Added ${value} miles to your ${targetCar.make}. New total is ${finalMileage.toFixed(0)}.` : `Updated total mileage for your ${targetCar.make} to ${finalMileage.toFixed(0)}.`, actionTaken: "mileage" };
    }

    // 8. NEXT LESSON QUERY PATTERN
    if (input.includes("next") && (input.includes("lesson") || input.includes("booking") || input.includes("schedule") || input.includes("who"))) {
      const { data: nextBooking, error } = await supabase.from("bookings").select("id, title, start_time, lesson_type, students(name)").eq("user_id", userId).eq("status", "scheduled").gt("start_time", new Date().toISOString()).order("start_time", { ascending: true }).limit(1).maybeSingle();
      if (error) return { success: false, message: "Failed to check schedule: " + error.message };
      if (!nextBooking) return { success: true, message: "You don't have any more lessons scheduled for today or in the future." };

      const startTime = parseISO(nextBooking.start_time);
      const studentName = (nextBooking.students as any)?.name || "a student";
      const timeStr = format(startTime, "p");
      const dateStr = isToday(startTime) ? "today" : isSameDay(startTime, startOfTomorrow()) ? "tomorrow" : `on ${format(startTime, "EEEE, MMM do")}`;

      return { success: true, message: `Your next lesson is with **${studentName}** at **${timeStr}** ${dateStr}. It's a **${nextBooking.lesson_type}**.`, actionTaken: "query_next_lesson" };
    }

    // 9. SUMMARY / REPORT PATTERN
    if (input.includes("summary") || input.includes("report") || input.includes("stats") || input.includes("how many lessons")) {
      const { date: targetDate } = parseDateTime(input);
      let start: Date, end: Date, label: string;

      if (input.includes("week")) {
        start = startOfWeek(targetDate, { weekStartsOn: 1 });
        end = endOfWeek(targetDate, { weekStartsOn: 1 });
        label = `the week of ${format(start, "MMM do")}`;
      } else if (input.includes("month")) {
        start = startOfMonth(targetDate);
        end = endOfMonth(targetDate);
        label = format(start, "MMMM yyyy");
      } else {
        start = startOfDay(targetDate);
        end = endOfDay(targetDate);
        label = isToday(targetDate) ? "today" : format(targetDate, "EEEE, MMM do");
      }

      const [profileRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("hourly_rate").eq("id", userId).single(),
        supabase.from("bookings").select("status, lesson_type, start_time, end_time").eq("user_id", userId).gte("start_time", start.toISOString()).lte("start_time", end.toISOString())
      ]);

      const rate = profileRes.data?.hourly_rate || 0;
      const bookings = bookingsRes.data || [];
      const delivered = bookings.filter(b => b.status === 'completed').length;
      const booked = bookings.filter(b => b.status === 'scheduled').length;
      const tests = bookings.filter(b => b.lesson_type === 'Driving Test' && b.status === 'completed').length;
      
      let totalMins = 0;
      bookings.filter(b => b.status === 'completed').forEach(b => { totalMins += differenceInMinutes(new Date(b.end_time), new Date(b.start_time)); });
      const earned = (totalMins / 60) * rate;

      return { success: true, message: `Here is your summary for **${label}**:\n\n` + `✅ **${delivered}** lessons delivered\n` + `📅 **${booked}** lessons currently booked\n` + `🚗 **${tests}** driving tests completed\n` + `💰 **£${earned.toFixed(2)}** earned (est.)`, actionTaken: "summary" };
    }

    // 10. MESSAGING PATTERN
    const isMessaging = input.includes("message") || input.includes("tell") || input.includes("send");
    if (isMessaging) {
      const msgParts = text.split(/[:]|saying|telling|that|message:/i);
      const searchArea = msgParts[0].toLowerCase();
      const student = students.find(s => searchArea.includes(s.name.toLowerCase()));

      if (student && msgParts.length > 1) {
        const content = msgParts[msgParts.length - 1].trim();
        if (content.length > 0) {
          await supabase.from("instructor_messages").insert({ instructor_id: userId, student_id: student.id, content: content, is_broadcast: false });
          if (student.auth_user_id) {
            await supabase.from("notifications").insert({ user_id: student.auth_user_id, title: "New Message", message: "Your instructor has sent you a private message.", type: "instructor_message" });
          }
          return { success: true, message: `I've sent that message to **${student.name}**.`, actionTaken: "send_message" };
        }
      }
    }

    // 11. DRIVING TEST RESULT PATTERN
    if (input.includes("test") && (input.includes("result") || input.includes("passed") || input.includes("failed") || input.includes("record"))) {
      const student = students.find(s => input.includes(s.name.toLowerCase()));
      const { date: testDate } = parseDateTime(input);
      const hasOutcome = input.includes("passed") || input.includes("failed");

      if (!student || !hasOutcome) {
        return { 
          success: true, 
          message: "Sure! I can help you record a test result. Which student was the test for?",
          newContext: { 
            pendingTestResult: { 
              step: student ? 'date' : 'student',
              student_id: student?.id,
              student_name: student?.name,
              test_date: student ? format(testDate, "yyyy-MM-dd") : null
            } 
          } 
        };
      }

      const passed = input.includes("passed");
      const drivingFaultsMatch = input.match(/(\d+)\s*(?:driving\s*)?faults?/i);
      const seriousFaultsMatch = input.match(/(\d+)\s*serious\s*faults?/i);
      const drivingFaults = drivingFaultsMatch ? parseInt(drivingFaultsMatch[1]) : 0;
      const seriousFaults = seriousFaultsMatch ? parseInt(seriousFaultsMatch[1]) : 0;
      const examinerAction = input.includes("examiner action") || input.includes("intervention");

      const { error } = await supabase.from("driving_tests").insert({
        user_id: userId,
        student_id: student.id,
        test_date: format(testDate, "yyyy-MM-dd"),
        passed: passed,
        driving_faults: drivingFaults,
        serious_faults: seriousFaults,
        examiner_action: examinerAction,
        notes: `Recorded via AI Assistant: ${text}`
      });

      if (error) return { success: false, message: "Failed to record test result: " + error.message };
      return { success: true, message: `Recorded test result for **${student.name}** on ${format(testDate, "MMM do")}. Result: **${passed ? 'PASSED' : 'FAILED'}** with ${drivingFaults} driving faults.`, actionTaken: "test_result" };
    }

    // 12. FIND BOOKING HELPER
    const findTargetBooking = async (searchStr: string) => {
      const { date: targetTime, timeProvided } = parseDateTime(searchStr);
      const student = students.find(s => searchStr.includes(s.name.toLowerCase()));
      let query = supabase.from("bookings").select("id, title, start_time, status").eq("user_id", userId);
      if (timeProvided) query = query.eq("start_time", targetTime.toISOString());
      else query = query.gte("start_time", startOfDay(targetTime).toISOString()).lte("start_time", endOfDay(targetTime).toISOString());
      if (student) query = query.eq("student_id", student.id);
      const { data: matches, error } = await query;
      return { matches: matches || [], targetTime, timeProvided, student, error };
    };

    // 13. DELETE/CANCEL BOOKING PATTERN
    if (input.includes("delete") || input.includes("cancel") || input.includes("remove")) {
      if (input.includes("booking") || input.includes("lesson") || input.includes("slot") || input.includes("test") || input.includes("gap") || input.includes("space")) {
        const { matches, targetTime, timeProvided, student } = await findTargetBooking(input);
        if (matches.length === 0) return { success: false, message: `I couldn't find a booking on ${format(targetTime, "MMM do")}${student ? ' for ' + student.name : ''}.` };
        if (matches.length > 1 && !timeProvided) {
          const times = matches.map(m => format(parseISO(m.start_time), "p")).join(", ");
          return { success: false, message: `I found multiple lessons on that day (at ${times}). Which one should I delete?` };
        }
        const bookingToDelete = matches[0];
        await supabase.from("bookings").delete().eq("id", bookingToDelete.id);
        return { success: true, message: `Deleted the booking: "${bookingToDelete.title}" at ${format(parseISO(bookingToDelete.start_time), "p")} on ${format(parseISO(bookingToDelete.start_time), "MMM do")}.`, actionTaken: "delete_booking" };
      }
    }

    // 14. UPDATE BOOKING STATUS
    const isStatusUpdate = input.includes("complete") || input.includes("done") || input.includes("finished") || input.includes("paid") || input.includes("settled");
    if (isStatusUpdate) {
      const isAll = input.includes("all") || input.includes("everything") || input.includes("every lesson");
      const { date: targetTime } = parseDateTime(input);
      if (isAll && (input.includes("complete") || input.includes("done") || input.includes("finished"))) {
        const { data: toUpdate } = await supabase.from("bookings").select("id").eq("user_id", userId).eq("status", "scheduled").gte("start_time", startOfDay(targetTime).toISOString()).lte("start_time", endOfDay(targetTime).toISOString());
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

    // 15. LESSON NOTE PATTERN
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
            await supabase.from("bookings").update({ description: noteParts[noteParts.length - 1].trim() }).eq("id", booking.id);
            return { success: true, message: `Added note to ${booking.title} on ${format(parseISO(booking.start_time), "MMM do")}.`, actionTaken: "lesson_note" };
          } else {
            return { success: true, message: "What would you like me to add to the notes?", newContext: { pendingNoteForLessonId: booking.id } };
          }
        }
      }
    }

    // 16. LESSON TARGET PATTERN
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
            await supabase.from("bookings").update({ targets_for_next_session: targetParts[targetParts.length - 1].trim() }).eq("id", booking.id);
            return { success: true, message: `Set target for ${booking.title} on ${format(parseISO(booking.start_time), "MMM do")}.`, actionTaken: "lesson_target" };
          } else {
            return { success: true, message: "What target would you like to set for this student?", newContext: { pendingTargetForLessonId: booking.id } };
          }
        }
      }
    }

    // 17. PROGRESS UPDATE PATTERN
    const isProgressUpdate = input.includes("star") || input.includes("rating") || input.includes("mark") || input.includes("progress") || input.includes("note") || input.includes("comment") || input.includes("feedback");
    if (isProgressUpdate) {
      const ratingMatch = input.match(/([1-5])\s*star/i) || input.match(/rating (?:of )?([1-5])/i) || input.match(/mark (?:as )?([1-5])/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
      let noteContent = null;
      let isPrivate = input.includes("private") || input.includes("instructor note");
      const noteParts = text.split(/[:]|note:|comment:|feedback:|saying/i);
      if (noteParts.length > 1) noteContent = noteParts[noteParts.length - 1].trim();
      const searchArea = noteParts[0].toLowerCase();
      const student = students.find(s => searchArea.includes(s.name.toLowerCase()));
      const sortedTopics = [...topics].sort((a, b) => b.name.length - a.name.length);
      const topic = sortedTopics.find(t => searchArea.includes(t.name.toLowerCase()));
      if (student && topic) {
        let finalRating = rating;
        if (finalRating === null) {
          const { data: existing } = await supabase.from("student_progress_entries").select("rating").eq("student_id", student.id).eq("topic_id", topic.id).order("entry_date", { ascending: false }).limit(1).maybeSingle();
          finalRating = existing?.rating || 3;
        }
        await supabase.from("student_progress_entries").insert({ user_id: userId, student_id: student.id, topic_id: topic.id, rating: finalRating, comment: isPrivate ? null : (noteContent || "Updated via Assistant"), private_notes: isPrivate ? noteContent : null, entry_date: new Date().toISOString() });
        let successMsg = `Updated ${student.name}'s ${topic.name}.`;
        if (rating) successMsg += ` Set to ${rating} stars.`;
        if (noteContent) successMsg += ` Added ${isPrivate ? 'private ' : ''}note.`;
        return { success: true, message: successMsg, actionTaken: "progress" };
      }
    }

    // 18. PRE-PAID HOURS PATTERN
    if (input.includes("add") && (input.includes("hour") || input.includes("credit") || input.includes("prepaid") || input.includes("pre-paid"))) {
      const student = students.find(s => input.includes(s.name.toLowerCase()));
      const amountMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|credit)s?/i);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

      if (!student || !amount) {
        return {
          success: true,
          message: "Sure! I can help you add pre-paid hours. " + (!student ? "Who would you like to add hours for?" : "How many would you like to add?"),
          newContext: {
            pendingPrePaidHours: {
              step: !student ? 'student' : 'amount',
              student_id: student?.id,
              student_name: student?.name,
              amount: amount
            }
          }
        };
      }

      // Direct add if both provided
      const { error } = await supabase.from("pre_paid_hours").insert({
        user_id: userId,
        student_id: student.id,
        package_hours: amount,
        remaining_hours: amount,
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        notes: "Added via AI Assistant"
      });

      if (error) return { success: false, message: "Failed to add hours: " + error.message };
      return { success: true, message: `Success! I've added **${amount} hours** of credit to **${student.name}**'s account.`, actionTaken: "add_prepaid_hours" };
    }

    // 19. BOOKING / SLOT PATTERN
    const isBookingAction = input.includes("book") || input.includes("add") || input.includes("create") || input.includes("set") || input.includes("put");
    const isBookingTarget = input.includes("lesson") || input.includes("slot") || input.includes("gap") || input.includes("space") || input.includes("test") || input.includes("appointment");
    if (isBookingAction && isBookingTarget) {
      // Check if we have enough info for a direct booking
      const student = students.find(s => input.includes(s.name.toLowerCase()));
      const { date: startTime, timeProvided } = parseDateTime(input);
      
      // If it's a vague "book a lesson" request, start the guided flow
      if (!student && !timeProvided && !input.includes("available")) {
        return {
          success: true,
          message: "Sure! I can help you book a lesson. What is the student's name?",
          newContext: {
            pendingBooking: {
              step: 'student'
            }
          }
        };
      }

      // If we have some info but not all, start the flow from the right step
      if (!student && !input.includes("available")) {
        return {
          success: true,
          message: "I've got the time, but who is the lesson for?",
          newContext: {
            pendingBooking: {
              step: 'student',
              date: format(startTime, "yyyy-MM-dd"),
              start_time: startTime.toISOString()
            }
          }
        };
      }

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
      if (input.includes("test")) { lessonType = "Driving Test"; if (!durationMatch) durationMins = 120; }
      else if (input.includes("personal")) lessonType = "Personal";
      else if (input.includes("available") || input.includes("availability") || input.includes("gap") || input.includes("space") || input.includes("bookable")) { lessonType = "Availability"; status = "available"; titlePrefix = "Available Slot"; }
      
      let studentId = student?.id || null;
      let studentName = student?.name || "Someone";
      if (lessonType === "Availability") titlePrefix = "Available Slot";
      else if (student) titlePrefix = `${student.name} - ${lessonType}`;
      else if (lessonType === "Personal") titlePrefix = "Personal Appointment";
      else {
        if (!input.includes("available") && !input.includes("gap") && !input.includes("space")) return { success: false, message: "I couldn't find a student with that name in your list." };
        lessonType = "Availability"; status = "available"; titlePrefix = "Available Slot";
      }

      if (!timeProvided && !input.includes("available") && !input.includes("gap")) {
        return {
          success: true,
          message: `I've got the student, but what date and time would you like to book for **${studentName}**?`,
          newContext: {
            pendingBooking: {
              step: 'date',
              student_id: studentId,
              student_name: studentName,
              lesson_type: lessonType,
              duration_mins: durationMins
            }
          }
        };
      }

      let repeatCount = 1;
      let intervalWeeks = 1; 
      const isWeekly = input.includes("weekly") || input.includes("every week");
      const isFortnightly = input.includes("fortnightly") || input.includes("every 2 weeks") || input.includes("every two weeks");
      const repeatMatch = input.match(/(?:repeat|for)\s+(\d+)\s*(?:weeks|times|occurrences)/i);
      const isRepeating = isWeekly || isFortnightly || !!repeatMatch;
      if (isFortnightly) intervalWeeks = 2;
      else if (isWeekly) intervalWeeks = 1;
      else if (!isRepeating) intervalWeeks = 0;
      if (repeatMatch) { repeatCount = parseInt(repeatMatch[1]); if (intervalWeeks === 0) intervalWeeks = 1; }
      else if (isWeekly || isFortnightly) repeatCount = 4; 
      const bookingsToInsert = [];
      for (let i = 0; i < repeatCount; i++) {
        const currentStart = addWeeks(startTime, i * intervalWeeks);
        const currentEnd = addMinutes(currentStart, durationMins);
        bookingsToInsert.push({ user_id: userId, student_id: studentId, title: titlePrefix, lesson_type: lessonType, start_time: currentStart.toISOString(), end_time: currentEnd.toISOString(), status: status });
      }
      await supabase.from("bookings").insert(bookingsToInsert);
      const durationStr = durationMins >= 60 ? `${durationMins / 60} hour(s)` : `${durationMins} mins`;
      let successMsg = `Added a ${durationStr} ${lessonType.toLowerCase()} ${studentId ? 'for ' + studentName : ''} at ${format(startTime, "p")} on ${format(startTime, "MMM do")}.`;
      if (lessonType === "Availability") successMsg = `Created a ${durationStr} availability slot at ${format(startTime, "p")} on ${format(startTime, "MMM do")}. Students can now book this space.`;
      if (repeatCount > 1) successMsg = `Created ${repeatCount} ${intervalWeeks === 1 ? 'weekly' : 'fortnightly'} ${durationStr} ${lessonType.toLowerCase()}s starting ${format(startTime, "MMM do")} at ${format(startTime, "p")}.`;
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