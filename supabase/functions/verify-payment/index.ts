import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
      purchase_id 
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !skill_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get Razorpay credentials from env
    const razorpayKeyId = Deno.env.get('VITE_RAZORPAY_KEY_ID') // updated
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') // updated

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('Razorpay credentials not configured')
      return new Response(
        JSON.stringify({ success: false, message: 'Payment gateway configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Verify the payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = createHmac('sha256', razorpayKeySecret)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      console.error('Payment signature verification failed')
      return new Response(
        JSON.stringify({ success: false, message: 'Payment signature verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch payment details from Razorpay
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'Content-Type': 'application/json',
      },
    })

    if (!paymentResponse.ok) {
      console.error('Failed to fetch payment details from Razorpay')
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to verify payment with gateway' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const paymentData = await paymentResponse.json()

    // Check if payment is captured and successful
    if (paymentData.status !== 'captured') {
      console.error('Payment not captured:', paymentData.status)
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verify the order ID matches
    if (paymentData.order_id !== razorpay_order_id) {
      console.error('Order ID mismatch')
      return new Response(
        JSON.stringify({ success: false, message: 'Order verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        payment_data: {
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
          amount: paymentData.amount,
          currency: paymentData.currency,
          method: paymentData.method,
          status: paymentData.status
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in verify-payment:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
