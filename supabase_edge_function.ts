import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const { type, email, studentName, startTime, endTime } = await req.json()

    let subject = ""
    let htmlContent = ""

    if (type === 'password_reset') {
      // 1. Generate the recovery link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: { redirectTo: `${req.headers.get('origin')}/reset-password` }
      })

      if (error) throw error

      subject = "Reset Your Password - Instructor App"
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin-bottom: 16px;">Password Reset Request</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.properties.action_link}" style="background-color: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, you can safely ignore this email. The link will expire shortly.</p>
        </div>
      `
    } else {
      // Default: Booking Notification
      subject = `New Lesson Booked: ${studentName}`
      htmlContent = `<h1>New Lesson Booked!</h1><p><strong>${studentName}</strong> has booked a slot.</p><p><strong>Time:</strong> ${startTime} - ${endTime}</p>`
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Instructor App <notifications@resend.dev>',
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})