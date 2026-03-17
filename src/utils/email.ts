import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface SendBookingEmailParams {
  to: string;
  studentName: string;
  startTime: Date;
  endTime: Date;
}

export const sendBookingNotificationEmail = async ({
  to,
  studentName,
  startTime,
  endTime
}: SendBookingEmailParams) => {
  try {
    // We call the Supabase Edge Function instead of Resend directly
    const { data, error } = await supabase.functions.invoke('send-booking-email', {
      body: {
        to,
        studentName,
        startTime: format(startTime, "EEEE, MMMM do 'at' p"),
        endTime: format(endTime, "p"),
      },
    });

    if (error) throw error;
    console.log("Email function response:", data);
    return data;
  } catch (error) {
    console.error("Failed to trigger email function:", error);
    throw error;
  }
};