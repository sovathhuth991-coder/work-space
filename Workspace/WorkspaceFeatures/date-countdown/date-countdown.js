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
    const START_KEY = 'activeCountdownStart';

    // ----- INITIALIZATION -----
    function init() {
        // Load any saved countdown
        loadSavedCountdown();

        // Always render something into the dashboard card — either the
        // restored live countdown or the empty-state date picker.
        updateDashboardCountdown();

        // Expose globally for calendar.js
        window.startCountdown = startCountdown;
        window.stopCountdown = stopCountdown;
        window.clearCountdown = clearCountdown;
        window.updateDashboardCountdown = updateDashboardCountdown;
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
            localStorage.setItem(START_KEY, new Date().toISOString());
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
            localStorage.removeItem(START_KEY);
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
                    if (!localStorage.getItem(START_KEY)) {
                        // Pre-existing countdown from before progress tracking was
                        // added — treat "now" as the start so the bar still works.
                        localStorage.setItem(START_KEY, now.toISOString());
                    }
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
            // Countdown complete — this only happens once, so a full
            // rebuild here is fine (unlike the ticking case below).
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

        // Build the static card structure only once (first render, or if
        // the panel currently holds something else, e.g. it just switched
        // out of the "complete" state). Every subsequent tick — every
        // second — just updates the four digit values directly. This used
        // to do `panel.innerHTML = ...` unconditionally on every tick,
        // which destroyed and recreated the whole card every second,
        // retriggering its CSS fade-in animation every second. That
        // constant re-fade-in was the "blinking."
        if (!panel.querySelector('.countdown-card')) {
            panel.innerHTML = `
                <div class="countdown-card">
                    <div class="countdown-header">
                        <div class="countdown-title">⏳ Countdown to Event</div>
                        <button class="countdown-close" onclick="clearCountdown()" title="Clear countdown">✕</button>
                    </div>
                    <div class="countdown-target-date" id="countdownTargetDateLabel"></div>
                    <div class="countdown-display">
                        <div class="countdown-unit">
                            <div class="countdown-value" id="countdownDaysVal">00</div>
                            <div class="countdown-label">Days</div>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <div class="countdown-value" id="countdownHoursVal">00</div>
                            <div class="countdown-label">Hours</div>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <div class="countdown-value" id="countdownMinutesVal">00</div>
                            <div class="countdown-label">Minutes</div>
                        </div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit">
                            <div class="countdown-value" id="countdownSecondsVal">00</div>
                            <div class="countdown-label">Seconds</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const dateLabel = document.getElementById('countdownTargetDateLabel');
        if (dateLabel) dateLabel.textContent = targetDateStr;
        const daysEl = document.getElementById('countdownDaysVal');
        if (daysEl) daysEl.textContent = dd;
        const hoursEl = document.getElementById('countdownHoursVal');
        if (hoursEl) hoursEl.textContent = hh;
        const minutesEl = document.getElementById('countdownMinutesVal');
        if (minutesEl) minutesEl.textContent = mm;
        const secondsEl = document.getElementById('countdownSecondsVal');
        if (secondsEl) secondsEl.textContent = ss;
    }

    // ----- UPDATE DASHBOARD COUNTDOWN -----
    function updateDashboardCountdown() {
        const panel = document.getElementById('dashDateCountdown');
        if (!panel) return;

        if (!targetDate) {
            panel.innerHTML = buildEmptyCountdownState();
            panel.style.display = 'block';
            return;
        }

        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            // Only happens once, so a full rebuild here is fine.
            panel.innerHTML = `
                <div class="dash-countdown-card countdown-complete">
                    <div class="countdown-icon">🎉</div>
                    <div class="countdown-title">Countdown Complete!</div>
                    <button class="matrix-btn" onclick="clearCountdown()" style="margin-top: 8px; font-size: 0.75rem; padding: 4px 12px;">Clear</button>
                </div>
            `;
            panel.style.display = 'block';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const targetDateStr = targetDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        let startDate;
        try {
            startDate = new Date(localStorage.getItem(START_KEY) || now.toISOString());
        } catch (e) {
            startDate = now;
        }
        const totalMs = targetDate - startDate;
        const elapsedMs = now - startDate;
        const progressPct = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;

        // Same fix as updateCountdownDisplay: build the card once, then
        // update its text on later ticks instead of rebuilding (and
        // re-triggering the fadeIn animation on) the whole card every
        // second — that constant re-fade was the "blinking" on the
        // Dashboard's countdown card too.
        if (!panel.querySelector('.dash-countdown-card:not(.countdown-complete)')) {
            panel.innerHTML = `
                <div class="dash-countdown-card">
                    <div class="dash-countdown-value" id="dashCountdownValueText"></div>
                    <div class="dash-countdown-caption">Days until <span id="dashCountdownDateLabel"></span></div>
                    <div class="dash-countdown-progress-track">
                        <div class="dash-countdown-progress-fill" id="dashCountdownProgressFill"></div>
                    </div>
                    <div class="dash-countdown-fine-print" id="dashCountdownFinePrint"></div>
                    <button class="matrix-btn" onclick="clearCountdown()" style="margin-top: 12px; font-size: 0.75rem; padding: 4px 12px;">Clear</button>
                </div>
            `;
        }

        const dateLabel = document.getElementById('dashCountdownDateLabel');
        if (dateLabel) dateLabel.textContent = targetDateStr;
        const valueEl = document.getElementById('dashCountdownValueText');
        if (valueEl) valueEl.textContent = String(days);
        const fillEl = document.getElementById('dashCountdownProgressFill');
        if (fillEl) fillEl.style.width = progressPct + '%';
        const fineEl = document.getElementById('dashCountdownFinePrint');
        if (fineEl) fineEl.textContent = `${hours}h ${minutes}m remaining today`;

        panel.style.display = 'block';
    }

    // ----- EMPTY STATE: pick a date directly from the dashboard card -----
    function buildEmptyCountdownState() {
        return `
            <div class="dash-countdown-empty">
                <div class="dash-countdown-empty-text">No countdown set</div>
                <div class="dash-countdown-empty-picker">
                    <input type="date" id="dashCountdownDateInput" class="dash-countdown-date-input" />
                    <button class="matrix-btn" onclick="window.__setDashCountdown()" style="font-size: 0.75rem; padding: 4px 12px;">Set</button>
                </div>
            </div>
        `;
    }

    window.__setDashCountdown = function() {
        const input = document.getElementById('dashCountdownDateInput');
        if (input && input.value) startCountdown(input.value);
    };

    // ----- SHOW COUNTDOWN PANELS -----
    function showCountdownPanels() {
        const schedulePanel = document.getElementById('dateCountdownPanel');
        if (schedulePanel) schedulePanel.style.display = 'block';
    }

    // ----- HIDE COUNTDOWN PANELS -----
    function hideCountdownPanels() {
        const schedulePanel = document.getElementById('dateCountdownPanel');
        if (schedulePanel) schedulePanel.style.display = 'none';
        updateDashboardCountdown();
    }

    // ----- INITIALIZE ON LOAD -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
