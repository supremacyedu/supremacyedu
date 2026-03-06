import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error("A valid numerical amount is required.");
    }

    const key_id = Deno.env.get('RAZORPAY_KEY_ID');
    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!key_id || !key_secret) {
      throw new Error("Server config error: Missing Razorpay API keys.");
    }

    // 2. Authenticate the User Making the Request
    // We grab the Auth token sent by your frontend to know exactly WHO clicked the button
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized user.");

    // 3. Generate the Secure Razorpay Order
    const amountInPaise = Math.round(amount * 100);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${key_id}:${key_secret}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_${Date.now()}`
      })
    });

    const order = await response.json();

    if (!response.ok) {
      console.error("Razorpay API Error:", order);
      throw new Error(order.error?.description || "Failed to create order with Razorpay.");
    }

    // 4. Log the "Ghost Order" into your new database table!
    const { error: dbError } = await supabase.from('orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount: amount,
      status: 'pending'
    });

    if (dbError) {
      console.error("Failed to log pending order:", dbError);
      // We log the error but don't crash the function, so the user can still pay!
    }
    
    // 5. Send the Order ID back to the website
    return new Response(JSON.stringify(order), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    console.error("Function Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});