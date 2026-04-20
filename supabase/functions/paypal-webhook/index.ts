import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const body = await req.json()

    // Log the event for debugging
    console.log("PayPal Webhook Received:", body.event_type)

    // We are looking for subscription creation or payment success
    if (body.event_type === 'BILLING.SUBSCRIPTION.CREATED' || body.event_type === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = body.resource.id || body.resource.billing_agreement_id
      
      // 1. Find the claim record that matches this ID
      const { data: claim, error: fetchError } = await supabaseAdmin
        .from('subscription_claims')
        .select('user_id')
        .eq('stripe_session_id', subscriptionId)
        .single()

      if (claim) {
        // 2. Activate the user
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('id', claim.user_id)

        // 3. Mark claim as verified
        await supabaseAdmin
          .from('subscription_claims')
          .update({ status: 'approved' })
          .eq('stripe_session_id', subscriptionId)

        console.log(`Successfully automated activation for user: ${claim.user_id}`)
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (error) {
    console.error("Webhook Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})