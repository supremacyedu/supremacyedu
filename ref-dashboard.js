// ref-dashboard.js
import { initApp, showToast, currentUser, supabase } from './ref-shared.js';

let availableCommission = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Guard Auth
    const user = await initApp();
    if (!user) return; // Unpaid/Logged out users are stopped here.

    // 2. Populate Basic UI Details
    document.getElementById('display-name').innerText = user.full_name || 'Referrer';
    document.getElementById('display-ref-code').innerText = user.my_ref_code || 'PENDING';
    document.getElementById('display-plan').innerText = user.plan_name || 'PRO';
    document.getElementById('display-rate').innerText = `${user.plan_rate || 0}%`;
    
    // Unhide the dashboard content
    document.getElementById('dashboard-content').style.display = 'block';

    // 3. Fetch Math/Stats from Student Network
    await calculateStats();

    // 4. Setup Event Listeners for Modals
    setupModals();
});

async function calculateStats() {
    if (!currentUser.my_ref_code) return;

    // Fetch only the columns we need for math to keep it fast
    const { data: students, error } = await supabase
        .from('student_admissions')
        .select('course_fee, status')
        .eq('referrer_code', currentUser.my_ref_code);

    if (error) {
        showToast("Failed to fetch statistics", "error");
        return;
    }

    const commissionRate = Number(currentUser.plan_rate || 0) / 100;
    availableCommission = 0;
    let totalStudents = students ? students.length : 0;

    if (students && students.length > 0) {
        students.forEach(student => {
            const isPaid = student.status && student.status.toLowerCase() === 'paid';
            if (isPaid) {
                availableCommission += (Number(student.course_fee) * commissionRate);
            }
        });
    }

    // Update UI
    document.getElementById('total-students').innerText = totalStudents;
    document.getElementById('total-commission').innerText = `₹${availableCommission.toFixed(2)}`;
}

function setupModals() {
    // --- Payout Modal Logic ---
    const payoutModal = document.getElementById('payout-modal');
    
    document.getElementById('open-payout-btn').addEventListener('click', () => {
        if (availableCommission <= 0) {
            showToast("You have no unlocked commissions to withdraw.", "error");
            return;
        }
        document.getElementById('modal-available-commission').innerText = `₹${availableCommission.toFixed(2)}`;
        document.getElementById('payout-form').reset();
        payoutModal.style.display = 'flex';
    });

    document.getElementById('close-payout-btn').addEventListener('click', () => {
        payoutModal.style.display = 'none';
    });

    document.getElementById('payout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const holderName = document.getElementById('bank-holder').value.trim();
        const accNumber = document.getElementById('bank-acc').value.trim();
        const ifscCode = document.getElementById('bank-ifsc').value.trim().toUpperCase();
        const branchName = document.getElementById('bank-branch').value.trim();

        try {
            const { error } = await supabase.from('payout_requests').insert([{
                referrer_id: currentUser.id,
                wallet_type: 'Main',
                amount_requested: availableCommission,
                account_holder_name: holderName,
                account_number: accNumber,
                ifsc_code: ifscCode,
                branch_name: branchName,
                status: 'Pending'
            }]);

            if (error) throw error;

            showToast("Payout request submitted successfully!");
            payoutModal.style.display = 'none';
            
            const btn = document.getElementById('open-payout-btn');
            btn.innerText = "⏳ Payout Pending";
            btn.disabled = true;
            btn.classList.add('btn-locked');

        } catch (err) {
            showToast(err.message, "error");
        }
    });

    // --- Phone Edit Logic (Attached globally so sidebar buttons work) ---
    const phoneModal = document.getElementById('edit-phone-modal');
    
    window.openEditPhoneModal = (phoneType) => {
        document.getElementById('editing-phone-type').value = phoneType;
        document.getElementById('new-phone-input').value = '';
        document.getElementById('new-phone-input').placeholder = `Enter new Phone ${phoneType}`;
        phoneModal.style.display = 'flex';
    };

    document.getElementById('close-phone-btn').addEventListener('click', () => {
        phoneModal.style.display = 'none';
    });

    document.getElementById('edit-phone-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const phoneType = document.getElementById('editing-phone-type').value;
        const newPhone = document.getElementById('new-phone-input').value.trim();
        const updatePayload = phoneType === '1' ? { phone_1: newPhone } : { phone_2: newPhone };

        const { error } = await supabase.from('referrers').update(updatePayload).eq('id', currentUser.id);
        
        if (error) {
            showToast("Update failed: " + error.message, "error");
            return;
        }

        showToast(`Phone ${phoneType} updated successfully!`);
        phoneModal.style.display = 'none';
        
        // Update Sidebar UI instantly
        if (phoneType === '1') document.getElementById('sidebar-phone1').innerText = newPhone;
        if (phoneType === '2') document.getElementById('sidebar-phone2').innerText = newPhone;
    });
}