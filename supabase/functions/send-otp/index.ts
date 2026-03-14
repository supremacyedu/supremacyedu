import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const { phone } = await req.json()
    
    // 1. Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // 2. Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Save the OTP to your database (upsert handles overwriting old requests for the same number)
    const { error: dbError } = await supabase
      .from('otp_requests')
      .upsert({ phone: phone, otp: otp, created_at: new Date() })

    if (dbError) throw new Error('Failed to save OTP to database')

    // 4. Send via 2factor (Bypassing Voice Fallback)
    const apiKey = Deno.env.get('TWOFACTOR_API_KEY')
    const templateName = 'OTP1' // Your approved template name
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/${templateName}`

    const response = await fetch(url, { method: 'GET' })
    const data = await response.json()

    if (data.Status !== 'Success') throw new Error('2factor failed to send SMS')

    return new Response(JSON.stringify({ success: true, message: "OTP sent successfully" }), {
      headers: { "Content-Type": "application/json" }, status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" }, status: 400
    })
  }
})