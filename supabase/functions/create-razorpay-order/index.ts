import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency, skill_id, user_id, skill_name } = await req.json()

    if (!amount || !currency || !skill_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Razorpay credentials
    const razorpayKeyId = Deno.env.get('VITE_RAZORPAY_KEY_ID') 
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') 

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('Razorpay credentials not configured')
      return new Response(
        JSON.stringify({ success: false, message: 'Payment gateway configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Validate & convert amount (Razorpay expects paise)
    const numAmount = parseInt(amount)
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 10000000) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Short receipt (max 40 chars)
    const safeReceipt = `rcpt_${skill_id}_${Date.now()}`.slice(0, 40)

    const orderData = {
      amount: numAmount ,  // convert to paise
      currency,
      receipt: safeReceipt,
      notes: {
        skill_id,
        user_id,
        skill_name: skill_name || 'Learning Course',
        platform: 'learning_platform'
      }
    }

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    })

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.text()
      console.error('Razorpay API error:', errorData)
      return new Response(
        JSON.stringify({ success: false, message: 'Razorpay error', details: errorData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const order = await razorpayResponse.json()

    return new Response(
      JSON.stringify({ success: true, order, key: razorpayKeyId, message: 'Order created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in create-razorpay-order:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error', error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
