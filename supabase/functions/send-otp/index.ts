// Inside your serve function in index.ts
const API_KEY = Deno.env.get('FAST2SMS_API_KEY');
const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${API_KEY}&route=otp&variables_values=${otpCode}&numbers=${phone}`;

const response = await fetch(url, {
  method: 'GET',
});

const result = await response.json();
if (!result.return) {
  throw new Error(result.message || "Fast2SMS Error");
}