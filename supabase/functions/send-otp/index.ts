import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 1. Define the CORS headers to allow your website
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // You can change '*' to 'https://supremacyedu.com' later for stricter security
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 2. Intercept the browser's preflight 'OPTIONS' request and approve it immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let { phone } = await req.json()

// Remove any '+' signs the user might have typed
phone = phone.replace('+', '')

// If they only typed 10 digits, add the 91 country code (WITHOUT the +)
if (phone.length === 10) {
  phone = `91${phone}`
}
    // Generate a secure 4-digit OTP (e.g., 1000 to 9999)
const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabase
      .from('otp_requests')
      .insert({ phone_number: phone, otp: otp, expires_at: expiresAt })

    if (dbError) throw new Error(`Database error: ${dbError.message}`)

    const apiKey = Deno.env.get('TWOFACTOR_API_KEY')
    const templateName = 'OTP1' 
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/${templateName}`

    const response = await fetch(url, { method: 'GET' })
    const data = await response.json()

    if (data.Status !== 'Success') throw new Error(`2factor error: ${data.Details || JSON.stringify(data)}`)

    // 3. Make sure to include the corsHeaders in your final success response too
    return new Response(JSON.stringify({ success: true, message: "OTP sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
    })

  } catch (error) {
    // 4. And include corsHeaders in your error response
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400
    })
  }
})