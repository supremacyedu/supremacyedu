import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://dlszqasvqubjujkowrtl.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_er7TxyaoL2bTTUAKKEplfA_vj5IHVxM';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 0. PDF GENERATOR
window.downloadReceipt = function(paymentId, amount, refId, paymentTimestamp) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const userName = document.getElementById('fullName').value;

  let displayDate = new Date().toLocaleDateString();
  let displayTime = new Date().toLocaleTimeString();
  if (paymentTimestamp) {
      const d = new Date(paymentTimestamp);
      displayDate = d.toLocaleDateString();
      displayTime = d.toLocaleTimeString();
  }

  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42); 
  doc.text("Supremacy Edu", 20, 20);

  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105); 
  doc.text("Payment Receipt & Official Policy", 20, 30);

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 35, 190, 35);

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date of Payment: ${displayDate} at ${displayTime}`, 20, 50);
  doc.text(`Name: ${userName}`, 20, 60);
  doc.text(`Amount Paid: INR ${amount}`, 20, 70);
  doc.text(`Razorpay Receipt ID: ${paymentId}`, 20, 80);
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Your Referrer ID: ${refId}`, 20, 95);

  doc.line(20, 105, 190, 105);

  doc.setFontSize(14);
  doc.text("Terms & Conditions", 20, 120);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // ⬇️ CHANGE YOUR TERMS & CONDITIONS HERE ⬇️
  const terms = [
      "1. This document confirms your successful enrollment in Supremacy Edu.",
      "2. Your Referrer ID is permanent and must be used for all tracking.",
      "3. Enrollment kit fees are strictly non-refundable under any circumstance.",
      "4. Commissions are paid out according to your purchased kit tier.",
      "5. We reserve the right to suspend accounts engaged in fraudulent activity.",
      "6. [Replace this with your new rule]",
      "7. [Replace this with another new rule]"
  ];
  
  let y = 130;
  terms.forEach(term => {
      doc.text(term, 20, y);
      y += 8;
  });

  doc.save(`SupremacyEdu_Receipt_${refId}.pdf`);
};

window.chosenPlanFee = 0;
window.chosenPlanShare = '';

// 1. PROTECTION & INITIAL LOAD
async function initDashboard() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.replace("login.html");
      return;
    }

    const { data: profile } = await supabase.from('referrers').select('*').eq('id', user.id).single();
    
    if (profile) {
      document.getElementById('welcomeText').innerText = `Welcome back, ${profile.name}!`;
      
      document.getElementById('fullName').value = profile.name;
      document.getElementById('phone').value = profile.phone || "";

      if (profile.payment_status === 'paid') {
        document.getElementById('planStatusInfo').innerHTML = `
          <p style="color: #059669;"><strong>Status:</strong> Active (₹${profile.plan_type} Kit)</p>
          <p style="margin-top: 10px; font-size: 16px;">Referrer ID: <strong>${profile.referrer_id}</strong></p>`;

        const { data: payment } = await supabase
          .from('payments')
          .select('razorpay_payment_id, amount, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); 

        const receiptPaymentId = payment ? payment.razorpay_payment_id : "Legacy/Manual Activation";
        const receiptAmount = payment ? payment.amount : (profile.plan_type || "N/A");
        const receiptTime = payment ? payment.created_at : null; 

        const navBtn = document.getElementById('navDownloadReceipt');
        if(navBtn) {
            navBtn.style.display = 'block';
            navBtn.onclick = () => window.downloadReceipt(receiptPaymentId, receiptAmount, profile.referrer_id, receiptTime);
        }

        const mobileContainer = document.getElementById('mobileDownloadContainer');
        const mobileBtn = document.getElementById('btnMobileDownload');
        if(mobileContainer && mobileBtn) {
            mobileContainer.style.display = 'block';
            mobileBtn.onclick = () => window.downloadReceipt(receiptPaymentId, receiptAmount, profile.referrer_id, receiptTime);
        }
      }
    }
    document.body.style.display = 'block';
  } catch (err) {
    console.error("Initialization error:", err);
    window.location.replace("login.html");
  }
}

// 2. MODAL LOGIC
window.openDetailsModal = () => document.getElementById('detailsModal').classList.add('active');
window.closeAll = () => document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
window.logout = async () => { await supabase.auth.signOut(); window.location.replace("login.html"); };

// 3. ENROLLMENT FORM
document.getElementById('detailsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnVerify');
  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const rdeCode = document.getElementById('rdeCode');
  const rdeError = document.getElementById('rdeError');

  btn.innerText = "Processing..."; btn.disabled = true;
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.from('referrers').update({
    name: fullName.value, phone: phone.value, rde_code: rdeCode.value
  }).eq('id', user.id);

  if (error) {
    rdeError.innerText = error.message; rdeError.style.display = 'block';
  } else {
    window.closeAll(); document.getElementById('planModal').classList.add('active');
  }
  btn.innerText = "Verify & Continue"; btn.disabled = false;
});

// 4. PLAN SELECTION
window.selectPlan = (element, fee, share) => {
  document.querySelectorAll('.plan-option').forEach(card => card.classList.remove('selected'));
  element.classList.add('selected');
  window.chosenPlanFee = fee;
  window.chosenPlanShare = share;
  const payBtn = document.getElementById('btnProceedPayment');
  payBtn.disabled = false; payBtn.innerText = `Pay ₹${fee} Now`;
};

// 5. RAZORPAY PAYMENT
window.startPayment = async () => {
  if (!window.chosenPlanFee) return;
  const payBtn = document.getElementById('btnProceedPayment');
  payBtn.innerText = "Securing Order..."; payBtn.disabled = true;

  try {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { amount: window.chosenPlanFee }
    });
    
    if (error) throw error; 

    const options = {
      key: "rzp_live_SLBiU4cochPmaM", 
      amount: data.amount,
      currency: "INR",
      name: "Supremacy Edu",
      description: "Kit Fee Enrollment",
      order_id: data.id,
      prefill: { 
        name: document.getElementById('fullName').value, 
        contact: document.getElementById('phone').value 
      },
      theme: { color: "#3b82f6" },
      
      handler: async function (response) {
        payBtn.innerText = "Finalizing Account...";
        const { data: { user } } = await supabase.auth.getUser();
        
        await supabase.from('payments').insert([{
          user_id: user.id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          amount: window.chosenPlanFee
        }]);

        const { data: updatedData, error: updateError } = await supabase
          .from('referrers')
          .update({
            payment_status: 'paid',
            plan_type: window.chosenPlanFee.toString()
          })
          .eq('id', user.id)
          .select('referrer_id')
          .single();
          
        if (updateError) {
          alert("Error fetching your new ID. Please contact support.");
          return;
        }

        window.closeAll();
        document.getElementById('generatedRefId').innerText = updatedData.referrer_id;
        
        document.getElementById('btnDownloadReceipt').onclick = () => {
          window.downloadReceipt(response.razorpay_payment_id, window.chosenPlanFee, updatedData.referrer_id, new Date().toISOString());
        };

        document.getElementById('successModal').classList.add('active');
      },
      modal: {
        ondismiss: function() {
          payBtn.innerText = `Pay ₹${window.chosenPlanFee} Now`;
          payBtn.disabled = false;
        }
      }
    };
    
    const rzp = new window.Razorpay(options);
    rzp.open();
    
  } catch (err) {
    alert("Error securing order. Please contact support.");
    payBtn.innerText = `Pay ₹${window.chosenPlanFee} Now`; 
    payBtn.disabled = false;
  }
};

initDashboard();