const body = document.body;
const hourHand = document.querySelector('.hour');
const minuteHand = document.querySelector('.minute');
const secondHand = document.querySelector('.second');
const modeSwitch = document.querySelector('.mode-switch');

const digitalTimeEl = document.querySelector('#digital-time');
const digitalDateEl = document.querySelector('#digital-date');
const themeButtons = document.querySelectorAll('.theme-btn');

// Themed (saved)
const savedTheme = (theme) => {
    body.dataset.theme = theme;
    localStorage.setItem("theme", theme);

    themeButtons.forEach(btn => {
        // FIXED: Changed 'is-active' to 'in-active' to match your CSS file rules
        btn.classList.toggle('in-active', btn.dataset.theme === theme);
    });
};

// FIXED: Changed the broken SVGTextPathElement crash to your actual function
savedTheme(localStorage.getItem('theme') || 'light');

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        savedTheme(btn.dataset.theme);
    });
});

// Dark mode initialization
if (localStorage.getItem('mode') === 'Dark Mode') {
    body.classList.add('dark'); // FIXED: Adds class to match your CSS "body.dark" rule
    body.dataset.mode = 'dark';
    if (modeSwitch) modeSwitch.textContent = 'Light mode';
}

const toggleDarkMode = () => {
    // FIXED: Correctly toggles the dark background styles on and off
    body.classList.toggle('dark');
    
    const isDarkMode = body.classList.contains('dark');
    body.dataset.mode = isDarkMode ? 'dark' : 'light';
    
    if (modeSwitch) {
        modeSwitch.textContent = isDarkMode ? 'Light mode' : 'Dark mode';
    }
    localStorage.setItem("mode", isDarkMode ? 'Dark Mode' : 'Light Mode');
};

if (modeSwitch) {
    modeSwitch.addEventListener('click', toggleDarkMode);
    // Keyboard support
    modeSwitch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDarkMode();
        }
    });
}

// Analog hands + digital readout
const updateTime = () => {
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    const secToDeg = (seconds / 60) * 360;
    const minToDeg = ((minutes + seconds / 60) / 60) * 360;
    const hourToDeg = ((hours % 12 + minutes / 60) / 12) * 360; // FIXED: Added % 12 boundary reset
    
    // Safety check outputs to prevent errors if elements don't exist yet
    if (secondHand) secondHand.style.transform = `rotate(${secToDeg}deg)`;
    if (minuteHand) minuteHand.style.transform = `rotate(${minToDeg}deg)`;
    if (hourHand) hourHand.style.transform = `rotate(${hourToDeg}deg)`;

    if (digitalTimeEl) {
        digitalTimeEl.textContent = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(now);
    }
    if (digitalDateEl) {
        digitalDateEl.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(now);
    }
};

// FIXED: Call immediately on load so the hands aren't stuck at 12:00 for the first second
updateTime();

// Start runtime loops
setInterval(updateTime, 1000);