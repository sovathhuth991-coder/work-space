// ============================================================
// INTERACTIVE TUTORIAL SYSTEM
// ============================================================

(function() {
    'use strict';

    // ----- STATE -----
    let currentTutorial = null;
    let currentStep = 0;
    let tutorialOverlay = null;
    let highlightBox = null;
    let tooltipBox = null;
    let isTutorialActive = false;

    // ----- TUTORIAL DATA -----
    const tutorials = {
        dashboard: {
            title: 'Dashboard Tutorial',
            description: 'Learn how to use your command center',
            steps: [
                {
                    target: '.dash-banner',
                    title: 'Banner Card',
                    content: 'This is your daily overview. It shows your completion progress, current streak, and a personalized greeting. Watch the progress bar fill up as you complete tasks!',
                    position: 'bottom'
                },
                {
                    target: '.current-session-box',
                    title: 'Active Session',
                    content: 'Shows what you\'re currently working on. It automatically updates based on your schedule and the lesson you\'re viewing. "Up next" shows your next upcoming task.',
                    position: 'right'
                },
                {
                    target: '#dashStrikeList',
                    title: 'Master To-Do',
                    content: 'Your task list appears here. Check items off as you complete them. This syncs with the dedicated To-Do view. Click any checkbox to mark a task done!',
                    position: 'left'
                },
                {
                    target: '.dash-stats-container',
                    title: 'Stats Cards',
                    content: 'Four key metrics at a glance: Tasks Done, Today\'s Tasks, Lesson Folders, and Day Streak. Click any card to navigate to that section.',
                    position: 'top'
                }
            ]
        },
        schedule: {
            title: 'Schedule Tutorial',
            description: 'Master your weekly planning',
            steps: [
                {
                    target: '.day',
                    title: 'Day Cards',
                    content: 'Each day of the week is shown as a card. It displays task count, a preview of your first 3 tasks, and a progress bar. Click any day to see details!',
                    position: 'bottom'
                },
                {
                    target: '.today-highlight',
                    title: 'Today Highlight',
                    content: 'Today\'s card is highlighted with a star ⭐ and special border. This helps you quickly identify the current day.',
                    position: 'bottom'
                },
                {
                    target: '.modal-form-zone',
                    title: 'Task Creation Form',
                    content: 'When you click a day, this form appears on the left. Enter task details here: title, category, time, and recurrence. Use preset buttons for quick task creation!',
                    position: 'right'
                },
                {
                    target: '.timeline-list',
                    title: 'Timeline',
                    content: 'All tasks for the selected day appear here on the right. Click any task to edit it. Use action buttons to start timer, mark complete, or delete.',
                    position: 'left'
                },
                {
                    target: '.day-nav-pill',
                    title: 'Day Navigation',
                    content: 'Quickly switch between days using these pills. The active day is highlighted. The count badge shows how many tasks are scheduled.',
                    position: 'bottom'
                }
            ]
        },
        timer: {
            title: 'Focus Timer Tutorial',
            description: 'Boost productivity with timed sessions',
            steps: [
                {
                    target: '#sessionTracker',
                    title: 'Session Tracker',
                    content: 'This automatically links to your scheduled tasks! Select a task from the dropdown, set your target time, and watch your progress. It accumulates time across sessions and resets at midnight.',
                    position: 'bottom'
                },
                {
                    target: '#countdownDisplay',
                    title: 'Countdown Display',
                    content: 'Large, clear timer showing remaining time. Choose from presets (5, 25, 50 min) or create your own custom timer!',
                    position: 'bottom'
                },
                {
                    target: '#startBtn',
                    title: 'Timer Controls',
                    content: 'Start begins the countdown. Pause lets you take a break. Reset returns to the initial time. Simple and intuitive!',
                    position: 'bottom'
                },
                {
                    target: '.preset-btn',
                    title: 'Preset Timers',
                    content: 'Quick-select common durations: 5 min for breaks, 25 min for Pomodoro sessions, 50 min for deep work. Click any preset to select it.',
                    position: 'top'
                },
                {
                    target: '#customTimerInput',
                    title: 'Custom Timers',
                    content: 'Need a specific duration? Enter any number of minutes (1-999) and click "Add Timer". Your custom timers are saved and appear below. Hover to delete them.',
                    position: 'top'
                }
            ]
        },
        todo: {
            title: 'To-Do Tutorial',
            description: 'Master your task management',
            steps: [
                {
                    target: '.dash-add-todo-btn',
                    title: 'Add Tasks',
                    content: 'Click the "+ Add task" button to create a new task. Type your task and press Enter. It will appear in the list below.',
                    position: 'bottom'
                },
                {
                    target: '.strike-item',
                    title: 'Task List',
                    content: 'All your tasks appear here. Click the checkbox to mark complete (gets strikethrough). Tasks sync with the dashboard automatically.',
                    position: 'left'
                },
                {
                    target: '.todo-summary-grid',
                    title: 'Momentum Stats',
                    content: 'See your progress at a glance: total tasks, completed tasks, and completion percentage. Stay motivated by watching your progress grow!',
                    position: 'left'
                }
            ]
        },
        lessons: {
            title: 'Lessons Tutorial',
            description: 'Create and organize learning content',
            steps: [
                {
                    target: '#app-sidebar',
                    title: 'Explorer Panel',
                    content: 'Your folder tree on the left. Right-click for options: create folder, create page, rename, delete. Use the search bar to find lessons quickly.',
                    position: 'right'
                },
                {
                    target: '#live-ledger-output',
                    title: 'Rich Text Editor',
                    content: 'This is your workspace. Type `/` to open slash commands and insert blocks: headings, lists, code, callouts, and more. Everything auto-saves!',
                    position: 'top'
                },
                {
                    target: '#toggleFindBtn',
                    title: 'Find in Page',
                    content: 'Click the Find button (or use Ctrl+F) to search within the current page. Navigate through results with the arrow buttons.',
                    position: 'bottom'
                }
            ]
        },
        library: {
            title: 'Library Tutorial',
            description: 'Store and organize resources',
            steps: [
                {
                    target: '#library-search',
                    title: 'Search & Filter',
                    content: 'Find resources quickly using the search bar. Filter by category: Links, Videos, Documents, or Code snippets.',
                    position: 'bottom'
                },
                {
                    target: '#library-add-form',
                    title: 'Add Resources',
                    content: 'Click "+ Add Item" to expand the form. Enter title, URL, category, and tags. Tags help you organize and find resources later.',
                    position: 'bottom'
                },
                {
                    target: '#libraryItemsGrid',
                    title: 'Resource Grid',
                    content: 'Your saved resources appear as cards. Click to open. Color-coded by category for easy identification.',
                    position: 'top'
                }
            ]
        },
        habits: {
            title: 'Habits Tutorial',
            description: 'Build consistency with daily tracking',
            steps: [
                {
                    target: '.habits-grid',
                    title: 'Habit List',
                    content: 'Your habits appear here. Each habit shows its name, icon, current streak, and completion rate. Click "+ Add Habit" to create new ones.',
                    position: 'bottom'
                },
                {
                    target: '.habit-card',
                    title: 'Habit Cards',
                    content: 'Each card represents a habit. Check it off daily to build your streak. The visual progress keeps you motivated!',
                    position: 'left'
                }
            ]
        },
        analytics: {
            title: 'Analytics Tutorial',
            description: 'Insights into your productivity',
            steps: [
                {
                    target: '#focusHistoryContainer',
                    title: 'Session History',
                    content: 'See all your focus sessions in a timeline. Review duration, date, and associated tasks to understand your work patterns.',
                    position: 'bottom'
                },
                {
                    target: '#categoryBreakdownContainer',
                    title: 'Category Breakdown',
                    content: 'Pie chart showing how you spend your time across different categories: Study, Work, Personal, etc. Helps you balance your activities.',
                    position: 'left'
                },
                {
                    target: '#optimalTimesContainer',
                    title: 'Peak Performance',
                    content: 'Discover when you\'re most productive! This analyzes your focus sessions to find your optimal working hours.',
                    position: 'right'
                },
                {
                    target: '#conflictsContainer',
                    title: 'Scheduling Conflicts',
                    content: 'Automatic detection of overlapping tasks. Yellow warning badges appear on conflicting tasks. Resolve conflicts to optimize your schedule.',
                    position: 'top'
                }
            ]
        }
    };

    // ----- FUNCTIONS -----
    function initTutorialSystem() {
        createTutorialOverlay();
        setupTutorialNavigation();
    }

    function createTutorialOverlay() {
        // Create overlay container
        tutorialOverlay = document.createElement('div');
        tutorialOverlay.id = 'tutorialOverlay';
        tutorialOverlay.style.cssText = `
            display: none;
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        `;

        // Create highlight box
        highlightBox = document.createElement('div');
        highlightBox.id = 'tutorialHighlight';
        highlightBox.style.cssText = `
            position: absolute;
            border: 3px solid #a78bfa;
            border-radius: 12px;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 40px rgba(167, 139, 250, 0.8), 0 0 80px rgba(124, 109, 240, 0.4);
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 10000;
        `;

        // Create tooltip box
        tooltipBox = document.createElement('div');
        tooltipBox.id = 'tutorialTooltip';
        tooltipBox.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, rgba(45, 45, 70, 0.98) 0%, rgba(40, 40, 65, 0.98) 100%);
            border: 1px solid rgba(167, 139, 250, 0.5);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 80px rgba(167, 139, 250, 0.5);
            z-index: 10001;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        tooltipBox.innerHTML = `
            <div style="margin-bottom: 12px;">
                <h3 id="tutorialStepTitle" style="margin: 0 0 8px 0; font-size: 1.2rem; font-weight: 700; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.3);"></h3>
                <div id="tutorialProgress" style="font-size: 0.75rem; color: #a0a0b0; font-weight: 500;"></div>
            </div>
            <p id="tutorialStepContent" style="margin: 0 0 20px 0; font-size: 0.95rem; color: #e0e0f0; line-height: 1.7; text-shadow: 0 1px 4px rgba(0,0,0,0.2);"></p>
            <div style="display: flex; gap: 10px; justify-content: space-between;">
                <button id="tutorialPrev" style="padding: 8px 20px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #f0f0f0; cursor: pointer; font-weight: 600; transition: var(--transition);">
                    ← Previous
                </button>
                <button id="tutorialNext" style="padding: 8px 20px; border-radius: 8px; background: var(--accent-gradient); border: none; color: #fff; cursor: pointer; font-weight: 600; transition: var(--transition); box-shadow: 0 4px 16px rgba(124, 109, 240, 0.4);">
                    Next →
                </button>
            </div>
            <button id="tutorialClose" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.1); border: none; color: #e0e0f0; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: var(--transition);">
                ✕
            </button>
        `;

        tutorialOverlay.appendChild(highlightBox);
        tutorialOverlay.appendChild(tooltipBox);
        document.body.appendChild(tutorialOverlay);

        // Add event listeners
        document.getElementById('tutorialPrev').addEventListener('click', () => navigateStep(-1));
        document.getElementById('tutorialNext').addEventListener('click', () => navigateStep(1));
        document.getElementById('tutorialClose').addEventListener('click', closeTutorial);

        // Close on Escape
        document.addEventListener('keydown', handleTutorialKeydown);
    }

    function setupTutorialNavigation() {
        // Add click handlers to tutorial cards
        const tutorialCards = document.querySelectorAll('.tutorial-card');
        tutorialCards.forEach(card => {
            card.addEventListener('click', function(e) {
                const tutorialId = this.dataset.tutorial;
                const viewId = tutorialId + '-view';

                // Navigate to the view first
                if (typeof switchView === 'function') {
                    switchView(viewId);
                }

                // Wait for view to load, then start tutorial
                setTimeout(() => {
                    startTutorial(tutorialId);
                }, 300);
            });

            // Add hover effect
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
                this.style.borderColor = 'rgba(124, 109, 240, 0.5)';
                this.style.boxShadow = '0 8px 24px rgba(124, 109, 240, 0.2)';
                const arrow = this.querySelector('span[style*="transition: transform"]');
                if (arrow) arrow.style.transform = 'translateX(4px)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.borderColor = 'var(--border-color)';
                this.style.boxShadow = 'none';
                const arrow = this.querySelector('span[style*="transition: transform"]');
                if (arrow) arrow.style.transform = 'translateX(0)';
            });
        });
    }

    function startTutorial(tutorialId) {
        const tutorial = tutorials[tutorialId];
        if (!tutorial) return;

        currentTutorial = tutorial;
        currentStep = 0;
        isTutorialActive = true;

        tutorialOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Add entrance animation
        tutorialOverlay.style.opacity = '0';
        highlightBox.style.opacity = '0';
        tooltipBox.style.opacity = '0';

        setTimeout(() => {
            tutorialOverlay.style.transition = 'opacity 0.3s ease';
            tutorialOverlay.style.opacity = '1';
            highlightBox.style.opacity = '1';
            tooltipBox.style.opacity = '1';
        }, 10);

        showStep();
    }

    function showStep() {
        if (!currentTutorial || currentStep >= currentTutorial.steps.length) {
            closeTutorial();
            return;
        }

        const step = currentTutorial.steps[currentStep];
        const targetElement = document.querySelector(step.target);

        if (!targetElement) {
            console.warn(`Tutorial target not found: ${step.target}`);
            navigateStep(1);
            return;
        }

        // Update tooltip content with animation
        const titleEl = document.getElementById('tutorialStepTitle');
        const contentEl = document.getElementById('tutorialStepContent');
        const progressEl = document.getElementById('tutorialProgress');

        titleEl.style.opacity = '0';
        contentEl.style.opacity = '0';

        setTimeout(() => {
            titleEl.textContent = step.title;
            contentEl.textContent = step.content;
            progressEl.textContent = `Step ${currentStep + 1} of ${currentTutorial.steps.length}`;

            titleEl.style.transition = 'opacity 0.3s ease';
            contentEl.style.transition = 'opacity 0.3s ease';
            titleEl.style.opacity = '1';
            contentEl.style.opacity = '1';
        }, 150);

        // Update button states
        const prevBtn = document.getElementById('tutorialPrev');
        const nextBtn = document.getElementById('tutorialNext');

        prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = currentStep === currentTutorial.steps.length - 1 ? 'Finish ✓' : 'Next →';

        // Position highlight box with animation
        const rect = targetElement.getBoundingClientRect();
        const padding = 8;

        highlightBox.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        highlightBox.style.left = (rect.left - padding) + 'px';
        highlightBox.style.top = (rect.top - padding) + 'px';
        highlightBox.style.width = (rect.width + padding * 2) + 'px';
        highlightBox.style.height = (rect.height + padding * 2) + 'px';

        // Position tooltip
        positionTooltip(rect, step.position);
    }

    function positionTooltip(targetRect, position) {
        const tooltipRect = tooltipBox.getBoundingClientRect();
        const padding = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left, top;

        // Calculate position based on preference
        switch(position) {
            case 'top':
                left = targetRect.left + (targetRect.width / 2) - 200;
                top = targetRect.top - tooltipRect.height - padding;
                break;
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2) - 200;
                top = targetRect.bottom + padding;
                break;
            case 'left':
                left = targetRect.left - 420 - padding;
                top = targetRect.top;
                break;
            case 'right':
                left = targetRect.right + padding;
                top = targetRect.top;
                break;
            default:
                left = targetRect.left;
                top = targetRect.bottom + padding;
        }

        // Keep within viewport
        if (left < padding) left = padding;
        if (left + 400 > viewportWidth - padding) left = viewportWidth - 400 - padding;
        if (top < padding) top = targetRect.bottom + padding;
        if (top + tooltipRect.height > viewportHeight - padding) {
            top = targetRect.top - tooltipRect.height - padding;
        }

        // Animate tooltip position
        tooltipBox.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        tooltipBox.style.left = left + 'px';
        tooltipBox.style.top = top + 'px';
    }

    function navigateStep(direction) {
        currentStep += direction;

        if (currentStep < 0) {
            currentStep = 0;
            return;
        }

        if (currentStep >= currentTutorial.steps.length) {
            closeTutorial();
            return;
        }

        showStep();
    }

    function closeTutorial() {
        // Add exit animation
        tutorialOverlay.style.transition = 'opacity 0.3s ease';
        tutorialOverlay.style.opacity = '0';
        highlightBox.style.opacity = '0';
        tooltipBox.style.opacity = '0';

        setTimeout(() => {
            tutorialOverlay.style.display = 'none';
            document.body.style.overflow = '';
            isTutorialActive = false;
            currentTutorial = null;
            currentStep = 0;
        }, 300);
    }

    function handleTutorialKeydown(e) {
        if (!isTutorialActive) return;

        if (e.key === 'Escape') {
            closeTutorial();
        } else if (e.key === 'ArrowRight') {
            navigateStep(1);
        } else if (e.key === 'ArrowLeft') {
            navigateStep(-1);
        }
    }

    // ----- EXPOSE TO GLOBAL SCOPE -----
    window.startTutorial = startTutorial;
    window.closeTutorial = closeTutorial;

    // ----- INITIALIZE -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTutorialSystem);
    } else {
        initTutorialSystem();
    }

})();

// ============================================================
// FULL GUIDE MODAL — renders TUTORIAL.md into the tutorialGuideModal
// ============================================================
let tutorialGuideLoaded = false;

async function openTutorialGuide() {
    const modal = document.getElementById('tutorialGuideModal');
    const content = document.getElementById('tutorialGuideContent');
    if (!modal || !content) return;

    modal.style.display = 'flex';

    if (!tutorialGuideLoaded) {
        try {
            const response = await fetch('TUTORIAL.md');
            if (!response.ok) throw new Error('TUTORIAL.md not found (' + response.status + ')');
            const markdown = await response.text();

            if (typeof marked !== 'undefined') {
                content.innerHTML = marked.parse(markdown);
            } else {
                // Fallback if the CDN library failed to load (e.g. offline)
                content.innerHTML = '<pre style="white-space: pre-wrap;">' +
                    markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>';
            }
            tutorialGuideLoaded = true;
        } catch (err) {
            content.innerHTML = '<p style="color: var(--danger, #e74c3c);">Couldn\'t load the guide: ' +
                err.message + '</p>';
            if (typeof showToast === 'function') {
                showToast('Failed to load TUTORIAL.md', 'error');
            }
        }
    }
}

function closeTutorialGuide() {
    const modal = document.getElementById('tutorialGuideModal');
    if (modal) modal.style.display = 'none';
}

// Close on backdrop click (same pattern as the other modals)
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('tutorialGuideModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeTutorialGuide();
        });
    }
});

window.openTutorialGuide = openTutorialGuide;
window.closeTutorialGuide = closeTutorialGuide;
