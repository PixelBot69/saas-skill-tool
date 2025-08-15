import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      skill_id,
      user_id,
    } = await req.json()

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing payment details',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Razorpay configuration missing' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(razorpayKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(key => 
      crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    ).then(signature => 
      Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    )

    const isAuthentic = expectedSignature === razorpay_signature

    if (!isAuthentic) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payment verification failed - Invalid signature',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get payment details from Razorpay
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    const [paymentResponse, orderResponse] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      }),
      fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      })
    ])

    if (!paymentResponse.ok || !orderResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to fetch payment details from Razorpay',
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const payment = await paymentResponse.json()
    const order = await orderResponse.json()

    // Store purchase record in database
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        user_id: user_id,
        skill_id: skill_id,
        amount: payment.amount / 100, // Convert from paise to rupees
        currency: payment.currency,
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        payment_reference: payment.id,
        receipt_url: payment.invoice_url || null,
        failure_reason: null,
        metadata: {
          payment_method: payment.method,
          payment_status: payment.status,
          payment_captured: payment.captured,
          order_status: order.status,
        },
        verified: true,
        status: 'completed'
      })
      .select()

    if (error) {
      console.error('Error storing purchase:', error)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payment verified but failed to store purchase record',
          error: error.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        data: {
          purchase_id: data[0]?.id,
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error verifying payment:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Payment verification failed',
        error: error.message,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})