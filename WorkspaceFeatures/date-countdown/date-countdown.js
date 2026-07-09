// ============================================================
// DATE COUNTDOWN TIMER
// Counts down to a selected calendar date
// Persists across page navigation via localStorage
// ============================================================

(function() {
    'use strict';

    // ----- STATE -----
    let countdownInterval = null;
    let targetDate = null;
    let countdownElement = null;
    let dashCountdownElement = null;

    // ----- CONSTANTS -----
    const STORAGE_KEY = 'activeCountdownDate';

    // ----- INITIALIZATION -----
    function init() {
        // Load any saved countdown
        loadSavedCountdown();

        // Expose globally for calendar.js
        window.startCountdown = startCountdown;
        window.stopCountdown = stopCountdown;
        window.clearCountdown = clearCountdown;
    }

    // ----- START COUNTDOWN -----
    function startCountdown(date) {
        // Clear existing countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        // Store the target date
        targetDate = new Date(date);

        // Save to localStorage for persistence
        try {
            localStorage.setItem(STORAGE_KEY, targetDate.toISOString());
        } catch (e) {
            console.error('Error saving countdown:', e);
        }

        // Update displays
        updateCountdownDisplay();
        updateDashboardCountdown();

        // Start interval (update every second)
        countdownInterval = setInterval(() => {
            updateCountdownDisplay();
            updateDashboardCountdown();
        }, 1000);

        // Show the countdown panels
        showCountdownPanels();
    }

    // ----- STOP COUNTDOWN -----
    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    // ----- CLEAR COUNTDOWN -----
    function clearCountdown() {
        stopCountdown();
        targetDate = null;

        // Remove from localStorage
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Error clearing countdown:', e);
        }

        // Hide panels
        hideCountdownPanels();
    }

    // ----- LOAD SAVED COUNTDOWN -----
    function loadSavedCountdown() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const savedDate = new Date(saved);
                const now = new Date();

                // Only restore if the date is still in the future
                if (savedDate > now) {
                    targetDate = savedDate;
                    updateCountdownDisplay();
                    updateDashboardCountdown();
                    showCountdownPanels();

                    countdownInterval = setInterval(() => {
                        updateCountdownDisplay();
                        updateDashboardCountdown();
                    }, 1000);
                } else {
                    // Date has passed, clean up
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('Error loading countdown:', e);
        }
    }

    // ----- UPDATE COUNTDOWN DISPLAY -----
    function updateCountdownDisplay() {
        const panel = document.getElementById('dateCountdownPanel');
        if (!panel || !targetDate) return;

        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            // Countdown complete
            panel.innerHTML = `
                <div class="countdown-complete">
                    <div class="countdown-icon">🎉</div>
                    <div class="countdown-title">Countdown Complete!</div>
                    <div class="countdown-date">${targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    <button class="matrix-btn" onclick="clearCountdown()" style="margin-top: 12px;">Clear</button>
                </div>
            `;
            stopCountdown();
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        // Calculate time units
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Format with leading zeros
        const dd = String(days).padStart(2, '0');
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');

        const targetDateStr = targetDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        panel.innerHTML = `
            <div class="countdown-card">
                <div class="countdown-header">
                    <div class="countdown-title">⏳ Countdown to Event</div>
                    <button class="countdown-close" onclick="clearCountdown()" title="Clear countdown">✕</button>
                </div>
                <div class="countdown-target-date">${targetDateStr}</div>
                <div class="countdown-display">
                    <div class="countdown-unit">
                        <div class="countdown-value">${dd}</div>
                        <div class="countdown-label">Days</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-unit">
                        <div class="countdown-value">${hh}</div>
                        <div class="countdown-label">Hours</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-unit">
                        <div class="countdown-value">${mm}</div>
                        <div class="countdown-label">Minutes</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-unit">
                        <div class="countdown-value">${ss}</div>
                        <div class="countdown-label">Seconds</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ----- UPDATE DASHBOARD COUNTDOWN -----
    function updateDashboardCountdown() {
        const panel = document.getElementById('dashDateCountdown');
        const hubPanel = document.getElementById('hubCountdownDisplay');

        const buildCountdownHTML = () => {
            if (!targetDate) return '';

            const now = new Date();
            const diff = targetDate - now;

            if (diff <= 0) {
                return `
                    <div class="dash-countdown-card countdown-complete">
                        <div class="countdown-icon">🎉</div>
                        <div class="countdown-title">Countdown Complete!</div>
                    </div>
                `;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            const dd = String(days).padStart(2, '0');
            const hh = String(hours).padStart(2, '0');
            const mm = String(minutes).padStart(2, '0');

            const targetDateStr = targetDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            return `
                <div class="dash-countdown-card">
                    <div class="dash-countdown-header">
                        <span class="dash-countdown-icon">⏳</span>
                        <span class="dash-countdown-title">Upcoming Event</span>
                    </div>
                    <div class="dash-countdown-date">${targetDateStr}</div>
                    <div class="dash-countdown-display">
                        <span class="dash-countdown-value">${dd}d ${hh}h ${mm}m</span>
                    </div>
                    <button class="matrix-btn" onclick="clearCountdown()" style="margin-top: 8px; font-size: 0.75rem; padding: 4px 12px;">Clear</button>
                </div>
            `;
        };

        const html = buildCountdownHTML();

        if (panel) {
            panel.innerHTML = html;
            panel.style.display = html ? 'block' : 'none';
        }

        if (hubPanel) {
            hubPanel.innerHTML = html;
        }
    }

    // ----- SHOW COUNTDOWN PANELS -----
    function showCountdownPanels() {
        const schedulePanel = document.getElementById('dateCountdownPanel');
        const dashPanel = document.getElementById('dashDateCountdown');

        if (schedulePanel) schedulePanel.style.display = 'block';
        if (dashPanel) dashPanel.style.display = 'block';
    }

    // ----- HIDE COUNTDOWN PANELS -----
    function hideCountdownPanels() {
        const schedulePanel = document.getElementById('dateCountdownPanel');
        const dashPanel = document.getElementById('dashDateCountdown');

        if (schedulePanel) schedulePanel.style.display = 'none';
        if (dashPanel) dashPanel.style.display = 'none';
    }

    // ----- INITIALIZE ON LOAD -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
