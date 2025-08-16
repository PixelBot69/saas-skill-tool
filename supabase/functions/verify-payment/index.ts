// verify-payment.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import crypto from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // use SERVICE ROLE KEY (not anon key)
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, skill_id, user_id } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ success: false, message: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ success: false, message: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ✅ Fetch payment details from Razorpay to confirm success
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const authHeader = "Basic " + btoa(`${keyId}:${keySecret}`);

    const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    const paymentData = await paymentRes.json();

    if (paymentData.status !== "captured") {
      return new Response(JSON.stringify({ success: false, message: "Payment not captured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ✅ Insert into Supabase purchases table
    const { error } = await supabase.from("purchases").insert([
      {
        user_id,
        skill_id,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount: paymentData.amount / 100, // store in INR, not paise
        status: "success",
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ success: false, message: "Payment verified but DB insert failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Payment verified & stored", payment: paymentData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error in verify-payment:", err);
    return new Response(JSON.stringify({ success: false, message: "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
