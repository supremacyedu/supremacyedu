// ref-rewards.js
import { initApp, showToast, currentUser, supabase } from './ref-shared.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Guard Auth
    const user = await initApp();
    if (!user) return; // Unpaid/Logged out users are stopped here.

    // 2. Unhide Content & Load Initial Balance
    document.getElementById('rewards-content').style.display = 'block';
    document.getElementById('small-wallet-balance').innerText = user.secondary_wallet || '0.00';

    // 3. Process the 90-Day Lock
    evaluateWalletLock(user);

    // 4. Fetch Gamification Data
    await fetchGamificationData(user.id);
    
    // 5. Setup Secondary Payout Modal
    setupSecondaryPayout(user);
});

function evaluateWalletLock(user) {
    // Calculate unlock date: join date + 90 days
    const joinDate = new Date(user.created_at || Date.now());
    const unlockDate = new Date(joinDate.getTime() + (90 * 24 * 60 * 60 * 1000));
    const now = new Date();
    
    const dateText = document.getElementById('unlock-date-text');
    const withdrawBtn = document.getElementById('withdraw-secondary-btn');
    const balance = Number(user.secondary_wallet || 0);

    if (now >= unlockDate) {
        dateText.innerText = "Funds Unlocked!";
        dateText.style.color = "var(--success)";
        
        if (balance > 0) {
            withdrawBtn.disabled = false;
            withdrawBtn.classList.remove('btn-locked');
            withdrawBtn.innerText = "💸 Request Payout";
        } else {
            withdrawBtn.innerText = "No Funds Available";
        }
    } else {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateText.innerText = `Unlocks on: ${unlockDate.toLocaleDateString(undefined, options)}`;
    }
}

async function fetchGamificationData(userId) {
    const subRefList = document.getElementById('sub-referrers-list');
    const cardsGrid = document.getElementById('scratch-cards-grid');

    // A. Fetch Sub-Referrers
    const { data: subReferrers } = await supabase
        .from('referrers')
        .select('full_name, payment_status, created_at')
        .eq('referred_by_id', userId)
        .order('created_at', { ascending: false });

    if (!subReferrers || subReferrers.length === 0) {
        subRefList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No referrers have used your code yet. Share it around!</div>';
    } else {
        subRefList.innerHTML = '';
        subReferrers.forEach(sub => {
            const isPaid = sub.payment_status === 'paid';
            subRefList.innerHTML += `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: white; font-weight: bold; font-size: 14px;">${sub.full_name || 'Anonymous'}</span>
                    <span style="color: ${isPaid ? 'var(--success)' : '#fbbf24'}; font-size: 11px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px;">
                        ${isPaid ? 'ACTIVATED' : 'PENDING'}
                    </span>
                </div>
            `;
        });
    }

    // B. Fetch Scratch Cards
    const { data: cards } = await supabase
        .from('scratch_cards')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

    if (!cards || cards.length === 0) {
        cardsGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; grid-column: span 2; text-align: center; padding: 20px;">Earn scratch cards when your sub-referrers activate their accounts.</div>';
    } else {
        cardsGrid.innerHTML = '';
        cards.forEach(card => {
            if (card.status === 'claimed') {
                cardsGrid.innerHTML += `
                    <div style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                        <span style="color: var(--success); font-size: 24px; font-weight: 800;">₹${card.amount}</span>
                        <div style="color: var(--success); font-size: 10px; margin-top: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Claimed</div>
                    </div>
                `;
            } else {
                cardsGrid.innerHTML += `
                    <div onclick="scratchCard('${card.id}')" style="background: linear-gradient(135deg, var(--primary), #2563eb); border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);">
                        <span style="color: white; font-size: 16px; font-weight: bold;">✨ Scratch Me!</span>
                    </div>
                `;
            }
        });
    }
}

// Global function so the inline HTML onclick works
window.scratchCard = async (cardId) => {
    // 1. Update DB (The DB trigger will automatically add the money to secondary_wallet)
    const { error } = await supabase
        .from('scratch_cards')
        .update({ status: 'claimed' })
        .eq('id', cardId);

    if (error) {
        showToast("Error claiming card. Try again.", "error");
        return;
    }

    showToast("Card scratched successfully! ✨");

    // 2. Fetch the fresh user balance from the database
    const { data: updatedUser } = await supabase
        .from('referrers')
        .select('secondary_wallet')
        .eq('id', currentUser.id)
        .single();
        
    if (updatedUser) {
        currentUser.secondary_wallet = updatedUser.secondary_wallet;
        document.getElementById('small-wallet-balance').innerText = Number(updatedUser.secondary_wallet).toFixed(2);
    }

    // 3. Refresh Gamification UI
    await fetchGamificationData(currentUser.id);
};

function setupSecondaryPayout(user) {
    const modal = document.getElementById('secondary-payout-modal');
    
    document.getElementById('withdraw-secondary-btn').addEventListener('click', () => {
        document.getElementById('modal-secondary-commission').innerText = `₹${user.secondary_wallet}`;
        document.getElementById('secondary-payout-form').reset();
        modal.style.display = 'flex';
    });

    document.getElementById('close-sec-payout-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('secondary-payout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const holderName = document.getElementById('bank-holder').value.trim();
        const accNumber = document.getElementById('bank-acc').value.trim();
        const ifscCode = document.getElementById('bank-ifsc').value.trim().toUpperCase();
        const branchName = document.getElementById('bank-branch').value.trim();

        try {
            const { error } = await supabase.from('payout_requests').insert([{
                referrer_id: user.id,
                wallet_type: 'Secondary', // Explicitly marked as the small wallet
                amount_requested: user.secondary_wallet,
                account_holder_name: holderName,
                account_number: accNumber,
                ifsc_code: ifscCode,
                branch_name: branchName,
                status: 'Pending'
            }]);

            if (error) throw error;

            showToast("Secondary Payout requested successfully!");
            modal.style.display = 'none';
            
            const btn = document.getElementById('withdraw-secondary-btn');
            btn.innerText = "⏳ Payout Pending";
            btn.disabled = true;
            btn.classList.add('btn-locked');

        } catch (err) {
            showToast(err.message, "error");
        }
    });
}