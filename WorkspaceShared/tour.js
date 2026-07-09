// WorkspaceJS/tour.js

let tourActive = false;

function startTour() {
  if (tourActive) return;
  const steps = [
    { target: '#dashboard-view', title: 'Dashboard', content: 'Your command center – see today\'s progress and live session.' },
    { target: '#schedule-view', title: 'Weekly Schedule', content: 'Plan your week. Click any day to add tasks.' },
    { target: '#timer-view', title: 'Focus Timer', content: 'Stay locked in with a pomodoro timer linked to your schedule.' },
    { target: '#todo-view', title: 'Master To-Do', content: 'Manage your global task list. Check items off as you go.' },
    { target: '#lessons-view', title: 'Lessons', content: 'Take notes, organise subjects, and link them to tasks.' }
  ];

  let currentStep = 0;
  const overlay = document.createElement('div');
  overlay.id = 'tourOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
  document.body.appendChild(overlay);

  function showStep(index) {
    if (index >= steps.length) {
      overlay.remove();
      tourActive = false;
      localStorage.setItem('tourCompleted', 'true');
      showToast('Tour complete! You\'re ready to go.', 'success');
      return;
    }
    const step = steps[index];
    const el = document.querySelector(step.target);
    if (!el) {
      showStep(index + 1);
      return;
    }
    // Highlight element
    const rect = el.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position:fixed;
      top:${rect.top - 8}px;
      left:${rect.left - 8}px;
      width:${rect.width + 16}px;
      height:${rect.height + 16}px;
      border:2px solid var(--accent-1);
      border-radius:12px;
      background:rgba(124,109,240,0.1);
      box-shadow:0 0 40px rgba(124,109,240,0.3);
      z-index:10000;
      pointer-events:none;
      transition:all 0.3s;
    `;
    overlay.appendChild(highlight);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position:fixed;
      bottom:80px;
      left:50%;
      transform:translateX(-50%);
      max-width:400px;
      background:var(--bg-card);
      border:1px solid var(--border-color);
      border-radius:12px;
      padding:20px 28px;
      box-shadow:var(--shadow-elevated);
      z-index:10001;
      text-align:center;
      pointer-events:auto;
      backdrop-filter:blur(12px);
    `;
    tooltip.innerHTML = `
      <h3 style="margin:0 0 8px;color:var(--accent-1);">${step.title}</h3>
      <p style="margin:0 0 16px;color:var(--text-secondary);">${step.content}</p>
      <button class="matrix-btn" onclick="tourNext()" style="margin-right:8px;">${index === steps.length-1 ? 'Finish' : 'Next →'}</button>
      <button class="matrix-btn secondary" onclick="endTour()">Skip</button>
    `;
    overlay.appendChild(tooltip);
    window.tourNext = () => {
      overlay.innerHTML = '';
      showStep(index + 1);
    };
    window.endTour = () => {
      overlay.remove();
      tourActive = false;
      localStorage.setItem('tourCompleted', 'true');
    };
    tourActive = true;
  }

  showStep(0);
}

// Auto‑start if first visit
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('tourCompleted') && !localStorage.getItem('tourSkipped')) {
    setTimeout(startTour, 800);
  }
});

// Expose for manual trigger
window.startTour = startTour;
