// ref-network.js
import { initApp, showToast, currentUser, supabase } from './ref-shared.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Guard Auth
    const user = await initApp();
    if (!user) return; // Unpaid/Logged out users are stopped here.

    // 2. Unhide Content & Set Rate Badge
    document.getElementById('network-content').style.display = 'block';
    const commissionRate = Number(user.plan_rate || 0);
    document.getElementById('network-rate-badge').innerText = `${commissionRate}%`;

    // 3. Fetch and Populate Students
    await fetchStudentNetwork(commissionRate);
});

async function fetchStudentNetwork(commissionRate) {
    const tableBody = document.getElementById('students-table-body');

    // Stop if they somehow don't have a code yet
    if (!currentUser.my_ref_code) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">No REF code generated. Please activate your account.</td></tr>';
        return;
    }

    // Fetch students from Supabase
    const { data: students, error } = await supabase
        .from('student_admissions')
        .select('*')
        .eq('referrer_code', currentUser.my_ref_code)
        .order('created_at', { ascending: false });

    if (error) {
        showToast("Error fetching student network.", "error");
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f87171; padding: 40px;">Failed to load data.</td></tr>';
        return;
    }

    // Handle Empty State
    if (!students || students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 60px 20px;">
                    <div style="color: var(--text-muted); font-size: 40px; margin-bottom: 10px;">📭</div>
                    <div style="color: white; font-size: 16px; font-weight: bold; margin-bottom: 5px;">No students yet!</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Share your code <strong>${currentUser.my_ref_code}</strong> to start earning.</div>
                </td>
            </tr>`;
        return;
    }

    // Populate Data
    tableBody.innerHTML = '';
    const decimalRate = commissionRate / 100;

    students.forEach(student => {
        const isPaid = student.status && student.status.toLowerCase() === 'paid';
        let statusBadge = '';
        let commissionText = '';

        if (isPaid) {
            const earnedCommission = Number(student.course_fee) * decimalRate;
            statusBadge = `<span style="color: var(--success); background: rgba(74, 222, 128, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">PAID</span>`;
            commissionText = `<span style="color: var(--success); font-weight: bold;">+₹${earnedCommission.toFixed(2)}</span>`;
        } else {
            statusBadge = `<span style="color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">PENDING</span>`;
            commissionText = `<span style="color: var(--text-muted); font-weight: bold;">Pending</span>`;
        }
        
        const dateObj = new Date(student.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        
        tableBody.innerHTML += `
            <tr>
                <td><strong style="color: white;">${student.student_name}</strong></td>
                <td>${dateObj}</td>
                <td>${statusBadge}</td>
                <td>₹${student.course_fee}</td>
                <td>${commissionText}</td>
            </tr>
        `;
    });
}