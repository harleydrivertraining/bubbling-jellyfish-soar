import { format } from "date-fns";
import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
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
  const apiKey = import.meta.env.VITE_RESEND_API_KEY;

  if (!apiKey || apiKey.includes("your_actual_key")) {
    throw new Error("Resend API key is missing or invalid in .env");
  }

  const emailData = {
    from: "HDT App <notifications@drivinginstructorapp.co.uk>",
    to: [to],
    subject: `New Lesson Booked: ${studentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin-bottom: 16px;">New Lesson Booked!</h1>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;"><strong>${studentName}</strong> has just booked an available slot.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">${format(startTime, "EEEE, MMMM do")}</p>
          <p style="margin: 4px 0 0 0; color: #475569; font-size: 16px;">${format(startTime, "p")} - ${format(endTime, "p")}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Driving Instructor App</p>
      </div>
    `,
  };

  try {
    if (Capacitor.isNativePlatform()) {
      const options = {
        url: 'https://api.resend.com/emails',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        data: emailData,
      };
      const response = await CapacitorHttp.post(options);
      return response;
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(emailData),
      });
      if (!response.ok) throw new Error("Resend API error");
      return response;
    }
  } catch (error: any) {
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string) => {
  // Use the built-in Supabase method. 
  // This is the standard way to handle resets without Edge Functions.
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
  return data;
};