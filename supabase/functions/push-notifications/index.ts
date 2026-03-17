import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') // You get this from Firebase Console

serve(async (req) => {
  const { record } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 1. Get the user's push tokens
  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', record.user_id)

  if (!tokens || tokens.length === 0) return new Response('No tokens found')

  // 2. Send to FCM
  const results = await Promise.all(tokens.map(t => 
    fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: t.token,
        notification: {
          title: record.title,
          body: record.message,
          sound: "default"
        },
        data: {
          type: record.type,
          id: record.id
        }
      }),
    })
  ))

  return new Response(JSON.stringify({ sent: results.length }), { status: 200 })
})