import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const { phone, submitted_otp } = await req.json()

    // 1. Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Fetch the stored OTP for this phone number
    const { data, error } = await supabase
      .from('otp_requests')
      .select('otp, created_at')
      .eq('phone', phone)
      .single()

    if (error || !data) throw new Error('No OTP request found for this number')

    // 3. Verify the OTP
    if (data.otp !== submitted_otp) {
      throw new Error('Invalid OTP')
    }

    // Optional: Check expiration (e.g., 5 minutes)
    const now = new Date().getTime()
    const otpTime = new Date(data.created_at).getTime()
    if (now - otpTime > 5 * 60 * 1000) {
      throw new Error('OTP has expired')
    }

    // 4. Delete the OTP so it cannot be used again
    await supabase.from('otp_requests').delete().eq('phone', phone)

    // 5. Success! Return data to the frontend so you can log the user in
    return new Response(JSON.stringify({ success: true, message: "Phone verified" }), {
      headers: { "Content-Type": "application/json" }, status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" }, status: 400
    })
  }
})