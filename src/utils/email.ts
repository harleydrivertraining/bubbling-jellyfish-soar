"use client";

import { Resend } from 'resend';

// Note: In a production app, this should be handled via a Supabase Edge Function
// to keep your API key secure. For now, we'll use the environment variable.
const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export const sendBookingEmail = async ({
  to,
  subject,
  studentName,
  date,
  time,
  instructorName,
  type = 'confirmation'
}: {
  to: string;
  subject: string;
  studentName: string;
  date: string;
  time: string;
  instructorName: string;
  type?: 'confirmation' | 'notification';
}) => {
  if (!import.meta.env.VITE_RESEND_API_KEY) {
    console.warn("Resend API Key missing. Email not sent.");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'HDT App <onboarding@resend.dev>', // Replace with your verified domain in production
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1e293b;">Lesson ${type === 'confirmation' ? 'Confirmed' : 'Booked'}</h2>
          <p>Hello ${type === 'confirmation' ? studentName : instructorName},</p>
          <p>${type === 'confirmation' 
            ? `Your driving lesson with <strong>${instructorName}</strong> has been scheduled.` 
            : `<strong>${studentName}</strong> has booked an available slot.`}</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
          </div>
          
          <p style="color: #64748b; font-size: 14px;">This is an automated notification from the HDT Instructor App.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
    }
    return data;
  } catch (err) {
    console.error("Failed to send email:", err);
  }
};