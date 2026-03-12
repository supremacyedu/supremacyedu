import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Get the signature sent by Razorpay
    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();
    const event = JSON.parse(body);

    // 2. Initialize Supabase with Administrative Rights (Service Role)
    // This allows the function to update 'payment_status' even if RLS is locked for users.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Only process successful payments
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userEmail = payment.email; 

      // 4. Update the database securely
      const { error } = await supabase
        .from('referrers')
        .update({ 
            payment_status: 'paid',
            razorpay_payment_id: payment.id 
        })
        .eq('email', userEmail);

      if (error) throw error;
      console.log(`Payment confirmed for: ${userEmail}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
})
