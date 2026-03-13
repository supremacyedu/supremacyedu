import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY') || "YOUR_FAST2SMS_KEY_HERE";
const supabaseUrl = Deno.env.get('SUPABASE_URL') || "YOUR_SUPABASE_URL";
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "YOUR_SERVICE_KEY";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS for frontend requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { phone } = await req.json();

    if (!phone || phone.length < 10) {
      throw new Error("Invalid phone number");
    }

    // 1. Generate a random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save it to the database (expires in 5 minutes)
    const expiresAt = new Date(new Date().getTime() + 5 * 60000).toISOString();
    const { error: dbError } = await supabase.from('otp_requests').insert([{
        phone_number: phone,
        otp_code: otpCode,
        expires_at: expiresAt
    }]);

    if (dbError) throw dbError;

    // 3. Send the OTP via Fast2SMS API
    const fast2SmsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_API_KEY}&route=otp&variables_values=${otpCode}&numbers=${phone}`;
    
    const smsResponse = await fetch(fast2SmsUrl, { method: 'GET' });
    const smsData = await smsResponse.json();

    if (!smsData.return) {
      throw new Error("Fast2SMS failed to send message");
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP Sent Successfully" }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})