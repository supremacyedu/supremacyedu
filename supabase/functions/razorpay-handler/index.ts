import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();
    const event = JSON.parse(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userEmail = payment.email; 
      
      // SMART ROUTING: Check the notes we will send from the frontend to see who is paying
      const accountType = payment.notes?.account_type || 'referrer'; 
      const targetTable = accountType === 'rde' ? 'rdes' : 'referrers';

      // Update the correct table dynamically
      const { error } = await supabase
        .from(targetTable)
        .update({ 
            payment_status: 'paid',
            razorpay_payment_id: payment.id 
        })
        .eq('email', userEmail);

      if (error) throw error;
      console.log(`Payment confirmed for ${accountType}: ${userEmail}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
})