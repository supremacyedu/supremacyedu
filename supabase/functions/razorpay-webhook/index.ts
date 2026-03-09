import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Supabase client with the Master Service Key (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    const bodyText = await req.text();
    const event = JSON.parse(bodyText);

    // Only process successful payments
    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      
      // Extract the hidden notes we sent from the frontend
      const userId = event.payload.payment.entity.notes.user_id; 
      const paymentType = event.payload.payment.entity.notes.payment_type; 

      if (!userId || !paymentType) {
        throw new Error("Missing user_id or payment_type in Razorpay notes");
      }

      // ==========================================
      // ROUTE 1: RDE Candidate Payment
      // ==========================================
      if (paymentType === 'rde_activation') {
        const { data: newRdeCode } = await supabase.rpc('generate_secure_rde_code');
        
        await supabase.from('hiring_applications').update({
            payment_status: 'paid',
            application_status: 'under_review',
            razorpay_payment_id: paymentId,
            generated_rde_code: newRdeCode
        }).eq('id', userId);
      }
      
      // ==========================================
      // ROUTE 2: Referrer Subscription Payment
      // ==========================================
      else if (paymentType === 'referrer_activation') {
        const { data: newRefCode } = await supabase.rpc('generate_secure_ref_code');
        
        await supabase.from('referrers').update({
            payment_status: 'paid',
            razorpay_payment_id: paymentId,
            personal_code: newRefCode
        }).eq('id', userId);
      }

      else {
         console.log("Unknown payment type:", paymentType);
      }
    }

    return new Response(JSON.stringify({ status: "success" }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { "Content-Type": "application/json" },
      status: 400 
    });
  }
})