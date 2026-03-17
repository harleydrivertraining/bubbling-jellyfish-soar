import { format } from "date-fns";
import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

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

  if (!apiKey) {
    console.warn("Resend API key missing in .env.");
    return;
  }

  if (!to) {
    console.warn("Instructor email missing.");
    return;
  }

  const emailData = {
    from: "HDT App <onboarding@resend.dev>",
    to: [to],
    subject: `New Lesson Booked: \${studentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin-bottom: 16px;">New Lesson Booked!</h1>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;"><strong>\${studentName}</strong> has just booked an available slot.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">\${format(startTime, "EEEE, MMMM do")}</p>
          <p style="margin: 4px 0 0 0; color: #475569; font-size: 16px;">\${format(startTime, "p")} - \${format(endTime, "p")}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Harley Driver Training</p>
      </div>
    `,
  };

  try {
    // If we are on a native device, use CapacitorHttp to bypass CORS
    if (Capacitor.isNativePlatform()) {
      const options = {
        url: 'https://api.resend.com/emails',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer \${apiKey}`
        },
        data: emailData,
      };

      const response = await CapacitorHttp.post(options);
      console.log("Native Email Response:", response);
      return response;
    } else {
      // Fallback for web (will likely fail CORS unless Resend allows it)
      console.warn("Running on Web: Standard fetch will likely be blocked by Resend CORS policy.");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer \${apiKey}`,
        },
        body: JSON.stringify(emailData),
      });
      return response;
    }
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};