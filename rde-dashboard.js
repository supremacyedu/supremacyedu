import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Initialize Supabase (Ensure these keys match your project exactly)
const supabase = createClient('https://dlszqasvqubjujkowrtl.supabase.co', 'sb_publishable_er7TxyaoL2bTTUAKKEplfA_vj5IHVxM');

// Global Variables
let currentApp = null;
let growthChartInstance = null;
let globalReferrersData = []; 
let globalRdeJoinDate = null; 

// --- 1. INITIALIZATION & AUTH ---
async function init() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return window.location.replace('rde-login.html');

    const { data: appData, error: appError } = await supabase.from('rdes').select('*').eq('id', session.user.id).single();
    if (appError || !appData) return window.location.replace('rde-login.html');
    
    currentApp = appData;
    document.getElementById('display-name').innerText = currentApp.full_name;

    // Check if they need to pay the dashboard activation fee
    if (currentApp.payment_status === 'unpaid' || currentApp.payment_status === 'pending') {
        document.getElementById('main-dashboard').classList.add('blurred');
        document.getElementById('payment-modal').style.display = 'flex';
    } else {
        window.unlockDashboard(true);
    }
}

// --- 2. SECURE PAYMENT HANDLING ---
window.payActivationFee = async () => {
    const msg = document.getElementById('pay-msg');
    if(msg) msg.style.display = "none";

    const options = {
        "key": "rzp_live_SLBiU4cochPmaM", // Your Razorpay Key
        "amount": 12000, // ₹120.00
        "currency": "INR",
        "name": "Supremacy Edu",
        "description": "RDE Dashboard Activation",
        "theme": { "color": "#3b82f6" },
        "prefill": {
            "name": currentApp.full_name,
            "email": currentApp.email,
            "contact": currentApp.phone
        },
        "notes": {
            "account_type": "rde" // SMART ROUTING: Tells Webhook to update the 'rdes' table
        },
        "handler": async function (response) {
            // SECURE POLLING: Wait for the Webhook to finish processing on the server
            document.getElementById('payment-modal').innerHTML = `
                <div style="text-align: center;">
                    <h2 style="color: #38bdf8;">Verifying Payment...</h2>
                    <p style="color: #94a3b8; margin-top: 10px;">Please wait while our secure server generates your RDE Code.</p>
                </div>
            `;
            
            const checkInterval = setInterval(async () => {
                const { data } = await supabase.from('rdes').select('payment_status, rde_code, razorpay_payment_id').eq('id', currentApp.id).single();
                
                if (data && data.payment_status === 'paid') {
                    clearInterval(checkInterval);
                    currentApp.rde_code = data.rde_code;
                    currentApp.payment_status = 'paid';
                    currentApp.razorpay_payment_id = data.razorpay_payment_id;
                    
                    document.getElementById('payment-modal').style.display = 'none';
                    document.getElementById('success-modal').style.display = 'flex';
                }
            }, 2000); // Check every 2 seconds
        }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response){
        if(msg) {
            msg.style.display = "block";
            msg.innerText = "Payment failed: " + response.error.description;
        }
    });
    rzp.open();
};

window.unlockDashboard = async (isInitialLoad = false) => {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('success-modal').style.display = 'none';
    document.getElementById('main-dashboard').classList.remove('blurred');
    
    if (currentApp.rde_code) {
        document.getElementById('display-rde-code').innerText = currentApp.rde_code;
        await fetchDashboardData(); 
    }
};

// --- 3. DASHBOARD DATA FETCHING ---
async function fetchDashboardData() {
    const rdeCode = currentApp.rde_code;

    // The Points Dictionary
    const pointsMap = { 
        120: 1, 300: 2.5, 600: 5, 900: 7.5, 
        1200: 10, 2400: 20, 6000: 50, 12000: 100 
    };

    try {
        // 1. Fetch all Plans
        const { data: plans } = await supabase.from('plans').select('id, name, price');
        const planDetails = {};
        if (plans) {
            plans.forEach(p => planDetails[p.id] = { name: p.name, price: p.price });
        }

        // 2. Fetch PAID Referrers
        const { data: referrers, error: refErr } = await supabase
            .from('referrers')
            .select('name, created_at, plan_id')
            .eq('referred_by_rde', rdeCode)
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: false });

        // 3. Fetch PAID RDEs
        const { data: rdes, error: rdeErr } = await supabase
            .from('rdes')
            .select('full_name, rde_code, created_at')
            .eq('referred_by_rde', rdeCode)
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: false });

        if (refErr) throw refErr;
        if (rdeErr) throw rdeErr;

        // Store data for the chart
        globalRdeJoinDate = new Date(currentApp.created_at);
        globalReferrersData = referrers.map(ref => {
            const plan = planDetails[ref.plan_id] || { price: 0 };
            const points = pointsMap[plan.price] || 0;
            return {
                created_at: ref.created_at,
                points: points
            };
        });

        // --- Calculate Daily Points & Populate Referrers Table ---
        let todayPoints = 0;
        const today = new Date().toDateString(); 
        
        const refTable = document.getElementById('referrers-table-body');
        refTable.innerHTML = '';
        
        if (referrers.length === 0) {
            refTable.innerHTML = '<tr><td colspan="4" class="empty-state">No paid referrers found yet.</td></tr>';
        } else {
            referrers.forEach(ref => {
                const plan = planDetails[ref.plan_id] || { name: 'Unknown', price: 0 };
                const points = pointsMap[plan.price] || 0;
                const dateObj = new Date(ref.created_at);
                
                if (dateObj.toDateString() === today) {
                    todayPoints += points;
                }

                refTable.innerHTML += `
                    <tr>
                        <td><strong>${ref.name}</strong></td>
                        <td>${dateObj.toLocaleDateString()}</td>
                        <td><span class="plan-tag">₹${plan.price} - ${plan.name}</span></td>
                        <td class="pts-tag">+${points} pts</td>
                    </tr>
                `;
            });
        }

        // --- Populate RDEs Sidebar List ---
        const rdeList = document.getElementById('rdes-list-body');
        rdeList.innerHTML = '';

        if (rdes.length === 0) {
            rdeList.innerHTML = '<li class="empty-state">No paid RDEs recruited yet.</li>';
        } else {
            rdes.forEach(r => {
                const dateObj = new Date(r.created_at);
                rdeList.innerHTML += `
                    <li class="rde-item">
                        <div class="rde-info">
                            <h4>${r.full_name}</h4>
                            <p>Joined ${dateObj.toLocaleDateString()}</p>
                        </div>
                        <div class="rde-code-badge">${r.rde_code}</div>
                    </li>
                `;
            });
        }

        // --- Update UI Counters and Progress Bar ---
        document.getElementById('ref-count').innerText = referrers.length;
        document.getElementById('rde-count').innerText = rdes.length;
        document.getElementById('today-points').innerText = todayPoints.toFixed(1);

        let progressPercentage = (todayPoints / 2.0) * 100;
        if (progressPercentage > 100) progressPercentage = 100;
        document.getElementById('daily-progress').style.width = `${progressPercentage}%`;

        if (todayPoints >= 2.0) {
            document.getElementById('daily-progress').style.background = '#fbbf24'; 
        }

        // Render the initial chart
        renderChart('daily');

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
    }
}

// --- 4. CHART GENERATION ENGINE ---
function renderChart(timeframe) {
    const canvas = document.getElementById('growthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const groupedData = {};
    const joinDate = globalRdeJoinDate ? new Date(globalRdeJoinDate) : new Date();

    globalReferrersData.forEach(ref => {
        const refDate = new Date(ref.created_at);
        const diffTime = refDate.getTime() - joinDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        
        let key;
        let sortOrder; 
        
        if (timeframe === 'daily') {
            key = refDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            sortOrder = refDate.getTime();
        } else if (timeframe === 'weekly') {
            const weekNum = Math.floor(diffDays / 7) + 1;
            key = 'Week ' + weekNum;
            sortOrder = weekNum;
        } else if (timeframe === 'monthly') {
            const monthNum = Math.floor(diffDays / 30) + 1;
            key = 'Month ' + monthNum;
            sortOrder = monthNum;
        }

        if (!groupedData[key]) {
            groupedData[key] = { points: 0, order: sortOrder };
        }
        
        groupedData[key].points += ref.points;
    });

    const sortedKeys = Object.keys(groupedData).sort((a, b) => groupedData[a].order - groupedData[b].order);
    const dataPoints = sortedKeys.map(key => groupedData[key].points);

    if (growthChartInstance) {
        growthChartInstance.destroy();
    }

    const titleEl = document.querySelector('.chart-header h3');
    if (titleEl) titleEl.innerText = 'Points Earned';

    growthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: 'Points Earned',
                data: dataPoints,
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.1)', 
                borderWidth: 3,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#4ade80',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + ' pts';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#64748b' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Chart Toggle Buttons Listener
document.addEventListener('DOMContentLoaded', () => {
    const controls = document.getElementById('chart-controls');
    if (controls) {
        controls.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                document.querySelectorAll('#chart-controls button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const timeframe = e.target.getAttribute('data-range');
                renderChart(timeframe);
            }
        });
    }
});

// --- 5. PDF GENERATION ---
window.generateAppointmentLetter = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(24);
    doc.text("Supremacy Edu", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Official Letter of Appointment", 105, 40, { align: "center" });
    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.text(`Date: ${dateStr}`, 20, 60);
    doc.text(`To,`, 20, 75);
    doc.setFont("helvetica", "bold");
    doc.text(`${currentApp.full_name}`, 20, 82);
    doc.setFont("helvetica", "normal");
    doc.text(`Phone: ${currentApp.phone}`, 20, 89);
    doc.text(`Email: ${currentApp.email}`, 20, 96);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(52, 211, 153); 
    doc.text(`Assigned RDE Code: ${currentApp.rde_code || 'Pending'}`, 20, 105);
    doc.setTextColor(0); 

    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${currentApp.full_name},`, 20, 125);
    
    const bodyText = `We are pleased to offer you the position of RDE (Sales & Operations) at Supremacy Edu. Your application and documents have been successfully processed by our system.\n\nYour tentative Date of Joining is recorded as ${dateStr}. You have been officially assigned the RDE code listed above. Please keep this document as official proof of your dashboard activation and preliminary onboarding step.\n\nOur HR Operations team will reach out to you shortly with your official orientation schedule and further instructions.`;
    
    const splitBody = doc.splitTextToSize(bodyText, 170);
    doc.text(splitBody, 20, 135);

    doc.text("Sincerely,", 20, 190);
    doc.setFont("helvetica", "bold");
    doc.text("Human Resources Department", 20, 200);
    doc.text("Supremacy Edu", 20, 207);

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.setFont("helvetica", "italic");
    doc.text("This is a computer-generated document and requires no physical signature.", 105, 270, { align: "center" });
    doc.text(`Payment Ref: ${currentApp.razorpay_payment_id || 'N/A'}`, 105, 276, { align: "center" });

    doc.save(`Appointment_Letter_${currentApp.full_name.replace(/\s+/g, '_')}.pdf`);
};

// --- 6. LOGOUT ---
window.logout = async () => {
    await supabase.auth.signOut();
    window.location.replace('rde-login.html');
};

// Start the app
init();