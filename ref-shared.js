// ref-shared.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ==========================================
// 1. SECURE CONFIGURATION
// ==========================================
const supabaseUrl = 'https://dlszqasvqubjujkowrtl.supabase.co';
const supabaseKey = 'sb_publishable_er7TxyaoL2bTTUAKKEplfA_vj5IHVxM';
const razorpayKey = 'rzp_live_SL3DDMXaD0elRg'; 

export const supabase = createClient(supabaseUrl, supabaseKey);
export let currentUser = null;

// ==========================================
// 2. GLOBAL TOAST SYSTEM
// ==========================================
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : '⚠️';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}

// ==========================================
// 3. AUTH GUARD & GLOBAL ROUTING
// ==========================================
export async function initApp() {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
        window.location.replace('ref-login.html');
        return null;
    }

    const { data: userData, error: userError } = await supabase
        .from('referrers')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (userError || !userData) {
        showToast("Error loading profile", "error");
        return null;
    }

    currentUser = userData;

    // --- DEBUGGING LOG --- 
    // Press F12 in your browser to see what this says!
    console.log("Current User Payment Status:", currentUser.payment_status);

    // --- THE GLOBAL PAYMENT WALL ---
    if (!currentUser.payment_status || currentUser.payment_status === 'unpaid' || currentUser.payment_status === 'pending') {
        const appLayout = document.querySelector('.app-layout');
        if(appLayout) {
            appLayout.style.filter = 'blur(10px)';
            appLayout.style.pointerEvents = 'none';
        }
        injectPaymentWall();
        return null; // Stops dashboard.js from loading data
    }

    // If they have paid, inject navigation and let them into the page
    injectNavigation();
    return currentUser;
}

// ==========================================
// 4. DYNAMIC HTML INJECTION
// ==========================================
function injectNavigation() {
    const currentPath = window.location.pathname;
    const isDash = currentPath.includes('ref-dashboard') || currentPath.endsWith('/');
    const isNetwork = currentPath.includes('ref-network');
    const isRewards = currentPath.includes('ref-rewards');

    const sidebarHTML = `
        <aside class="sidebar">
            <div class="brand-header">Supremacy Edu</div>
            <div class="profile-widget">
                <h3 id="sidebar-name">${currentUser.full_name || 'Referrer'}</h3>
                <div class="phone-display"><span>${currentUser.phone_1 || '+91 0000000000'}</span></div>
                <button id="global-logout-btn" class="btn-danger" style="width: 100%; margin-top: 15px; padding: 10px; cursor: pointer; font-weight: bold;">Log Out</button>
            </div>
            <nav class="sidebar-nav">
                <a href="ref-dashboard.html" class="nav-item ${isDash ? 'active' : ''}">Dashboard Home</a>
                <a href="ref-network.html" class="nav-item ${isNetwork ? 'active' : ''}">My Network</a>
                <a href="ref-rewards.html" class="nav-item ${isRewards ? 'active' : ''}">Rewards & Gamification</a>
            </nav>
        </aside>
    `;

    const mobileNavHTML = `
        <nav class="mobile-bottom-nav">
            <a href="ref-dashboard.html" class="mobile-nav-item ${isDash ? 'active' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Home
            </a>
            <a href="ref-network.html" class="mobile-nav-item ${isNetwork ? 'active' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Network
            </a>
            <a href="ref-rewards.html" class="mobile-nav-item ${isRewards ? 'active' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                Rewards
            </a>
        </nav>
    `;

    const sidebarContainer = document.getElementById('sidebar-container');
    const mobileNavContainer = document.getElementById('mobile-nav-container');
    
    if(sidebarContainer) sidebarContainer.innerHTML = sidebarHTML;
    if(mobileNavContainer) mobileNavContainer.innerHTML = mobileNavHTML;

    document.getElementById('global-logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.replace('ref-login.html');
    });
}

// ------------------------------------------
// THE FORTIFIED PAYMENT WALL HTML
// ------------------------------------------
function injectPaymentWall() {
    // Prevent duplicate injections
    if(document.getElementById('global-payment-wrapper')) return;

    // Using strictly inline styles to guarantee it overrides any CSS bugs
    const paymentHTML = `
        <div id="global-payment-wrapper" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(5, 10, 20, 0.95); display: flex; justify-content: center; align-items: flex-start; padding-top: 50px; padding-bottom: 50px; overflow-y: auto; z-index: 999999; backdrop-filter: blur(10px);">
            <div style="background: #0f172a; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: 90%; max-width: 900px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
                <h2 style="color: white; font-size: 28px; margin-top: 0;">Activate Your Referrer Portal</h2>
                <p style="color: #94a3b8; margin-bottom: 30px;">Select a package to generate your official REF Code and lock in your package share.</p>
                
                <div style="margin-bottom: 30px; text-align: left;">
                    <div style="color: white; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Starter Package</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹120</div>
                            <div style="color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(239, 68, 68, 0.05); align-self: flex-start;">NON-REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>1%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Starter - 1%', 120, 1)">Buy Package</button>
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹300</div>
                            <div style="color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(239, 68, 68, 0.05); align-self: flex-start;">NON-REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>2%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Starter - 2%', 300, 2)">Buy Package</button>
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹600</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>3%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Starter - 3%', 600, 3)">Buy Package</button>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 30px; text-align: left;">
                    <div style="color: white; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Growth Package</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹900</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>4%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Growth - 4%', 900, 4)">Buy Package</button>
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹1200</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>5%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Growth - 5%', 1200, 5)">Buy Package</button>
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹2400</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>6%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Growth - 6%', 2400, 6)">Buy Package</button>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 30px; text-align: left;">
                    <div style="color: white; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Premium Package</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹6000</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>8%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Premium - 8%', 6000, 8)">Buy Package</button>
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; display: flex; flex-direction: column;">
                            <div style="color: #38bdf8; font-size: 28px; font-weight: bold; margin-bottom: 10px;">₹12000</div>
                            <div style="color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 10px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; font-weight: bold; letter-spacing: 0.5px; background: rgba(74, 222, 128, 0.05); align-self: flex-start;">REFUNDABLE</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 20px; flex-grow: 1;">Earn <strong>10%</strong> share on your referrals.</div>
                            <button class="primary-btn" onclick="initiatePayment('Premium - 10%', 12000, 10)">Buy Package</button>
                        </div>
                    </div>
                </div>
                <div id="pay-msg" style="margin-top: 20px; font-size: 14px; color: #f87171; display: none; text-align: center;"></div>
            </div>
        </div>

        <div id="global-receipt-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(5, 10, 20, 0.95); display: none; justify-content: center; align-items: center; z-index: 9999999; backdrop-filter: blur(10px);">
            <div style="background: #0f172a; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: 90%; max-width: 500px; text-align: center;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="background: rgba(74, 222, 128, 0.2); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 style="color: white; margin: 0;">Payment Successful!</h2>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Your account is now activated.</p>
                </div>
                <div style="background: rgba(56, 189, 248, 0.1); border: 1px dashed #38bdf8; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <div style="color: #38bdf8; font-size: 14px; text-transform: uppercase; font-weight: bold;">Your Official REF Code</div>
                    <div id="revealed-ref-code" style="font-size: 32px; font-weight: 800; color: white; letter-spacing: 2px; margin-top: 10px;">LOADING...</div>
                    <div style="color: #94a3b8; font-size: 12px; margin-top: 10px;">Share this code with students to earn your commission.</div>
                </div>
                <button class="primary-btn" id="download-receipt-btn" style="background: transparent; border: 1px solid #38bdf8; color: #38bdf8; margin-bottom: 10px; width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer;">📥 Download Receipt</button>
                <button class="primary-btn" onclick="window.location.reload()" style="width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; cursor: pointer;">Go to Dashboard ➔</button>
            </div>
        </div>
    `;
    
    // Use insertAdjacentHTML so we don't accidentally wipe out the body or hide behind another div
    document.body.insertAdjacentHTML('beforeend', paymentHTML);
}

// ==========================================
// 5. RAZORPAY LOGIC 
// ==========================================
window.initiatePayment = async (planName, amountInInr, commissionRate) => {
    const msg = document.getElementById('pay-msg');
    msg.style.display = "none";

    const options = {
        "key": razorpayKey, 
        "amount": amountInInr * 100, 
        "currency": "INR",
        "name": "Supremacy Edu",
        "description": `${planName} Referrer Activation`,
        "theme": { "color": "#38bdf8" },
        "prefill": {
            "name": currentUser?.full_name || '',
            "contact": currentUser?.phone_1 || ''
        },
        "handler": async function (response) {
            const generatedRefCode = 'REF-' + Math.random().toString(36).substring(2, 6).toUpperCase();

            // Override the wall UI to show loading state
            document.getElementById('global-payment-wrapper').innerHTML = `
                <div style="max-width: 500px; padding: 60px; text-align: center; background: #0f172a; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="color: #38bdf8; margin-bottom: 15px;">Activating Account...</h2>
                    <p style="color: #94a3b8;">Please wait while we generate your unique REF code.</p>
                </div>
            `;

            const { error: updateError } = await supabase
                .from('referrers')
                .update({
                    payment_status: 'paid',
                    plan_name: planName,
                    plan_rate: commissionRate,
                    my_ref_code: generatedRefCode,
                    razorpay_payment_id: response.razorpay_payment_id
                })
                .eq('id', currentUser.id);

            if (updateError) {
                showToast("Database update failed: " + updateError.message, "error");
                return;
            }

            // Hide the wrapper, show the receipt modal
            document.getElementById('global-payment-wrapper').style.display = 'none';
            document.getElementById('revealed-ref-code').innerText = generatedRefCode;
            document.getElementById('global-receipt-modal').style.display = 'flex';

            // Attach download listener
            document.getElementById('download-receipt-btn').onclick = () => {
                const receiptText = `=========================================
      SUPREMACY EDU - PAYMENT RECEIPT
=========================================
Date: ${new Date().toLocaleString()}
Referrer Name: ${currentUser.full_name}
-----------------------------------------
Plan Purchased: ${planName}
Amount Paid: ₹${amountInInr}
Commission Rate Locked: ${commissionRate}%
Transaction ID: ${response.razorpay_payment_id}
-----------------------------------------
YOUR ASSIGNED REF CODE: ${generatedRefCode}
=========================================
Keep this code safe. Share it with students 
to track your commissions.`;

                const blob = new Blob([receiptText], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SupremacyEdu_Receipt_${generatedRefCode}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            };
        }
    };
    
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response){
        msg.style.display = "block";
        msg.innerText = "Payment failed: " + response.error.description;
    });
    rzp.open();
};