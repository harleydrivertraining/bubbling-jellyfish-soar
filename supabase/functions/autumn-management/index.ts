import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTUMN_API_KEY = Deno.env.get('AUTUMN_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the user from the JWT
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (userError || !user) throw new Error('Not authenticated')

    const { action, planId, returnUrl, successUrl } = await req.json()

    // 1. Create or Get Autumn Customer
    // We use the Supabase User ID as the Autumn Customer ID
    const customerId = user.id

    if (action === 'checkout') {
      // Call Autumn API to create a checkout session
      const response = await fetch('https://api.useautumn.com/v1/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTUMN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: customerId,
          plan_id: planId,
          success_url: successUrl,
          cancel_url: returnUrl,
          customer_email: user.email
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Autumn Checkout Error')
      
      return new Response(JSON.stringify({ url: data.url }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'portal') {
      // Call Autumn API to create a customer portal session
      const response = await fetch('https://api.useautumn.com/v1/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTUMN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: customerId,
          return_url: returnUrl
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Autumn Portal Error')
      
      return new Response(JSON.stringify({ url: data.url }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})