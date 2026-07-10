// At the top of sparkles.js
const PARTICLE_COUNT = 150;
const FRAME_SKIP = 2; // reduce frame rate for performance
let frameCount = 0;

// ============================================================
// GLITTER / SPARKLE BACKGROUND EFFECT
// ============================================================

const sparkleCanvas = document.getElementById('sparkleCanvas');
const sparkleCtx = sparkleCanvas.getContext('2d');
let sparkles = [];

// ---- Resize handler ----
function resizeSparkleCanvas() {
    sparkleCanvas.width = window.innerWidth;
    sparkleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSparkleCanvas);
resizeSparkleCanvas();

// ---- Sparkle class ----
class Sparkle {
    constructor() {
        this.reset();
        // Randomize initial phase so they don't all twinkle at once
        this.phase = Math.random() * Math.PI * 2;
    }

    reset() {
        this.x = Math.random() * sparkleCanvas.width;
        this.y = Math.random() * sparkleCanvas.height;
        this.size = Math.random() * 3 + 0.5;
        this.speed = 0.005 + Math.random() * 0.025;
        this.opacity = 0;
        this.maxOpacity = 0.3 + Math.random() * 0.7;
        this.driftX = (Math.random() - 0.5) * 0.05;
        this.driftY = (Math.random() - 0.5) * 0.05;

        // Color palette – gold, purple, cyan, pink, white
        const colors = [
            'rgba(255, 215, 0, ',
            'rgba(192, 132, 252, ',
            'rgba(56, 189, 248, ',
            'rgba(244, 114, 182, ',
            'rgba(255, 255, 255, '
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.twinkleSpeed = 0.008 + Math.random() * 0.035;
        this.phase = Math.random() * Math.PI * 2;
        this.pulseOffset = Math.random() * 2;
    }

    update() {
        // Twinkle using sine wave
        this.phase += this.twinkleSpeed;
        this.opacity = (Math.sin(this.phase) * 0.5 + 0.5) * this.maxOpacity;

        // Drift slowly
        this.x += this.driftX;
        this.y += this.driftY;

        // Wrap around edges
        if (this.x < -10) this.x = sparkleCanvas.width + 10;
        if (this.x > sparkleCanvas.width + 10) this.x = -10;
        if (this.y < -10) this.y = sparkleCanvas.height + 10;
        if (this.y > sparkleCanvas.height + 10) this.y = -10;

        // Occasionally reset if too dim for too long
        if (Math.random() < 0.0005) {
            this.reset();
        }
    }

    draw() {
        if (this.opacity < 0.01) return;

        const size = this.size * (0.5 + Math.sin(this.phase * 0.5) * 0.5 + 0.5);

        // Glow effect: larger, softer outer circle
        const gradient = sparkleCtx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, size * 4
        );
        gradient.addColorStop(0, this.color + this.opacity + ')');
        gradient.addColorStop(0.2, this.color + (this.opacity * 0.6) + ')');
        gradient.addColorStop(0.5, this.color + (this.opacity * 0.2) + ')');
        gradient.addColorStop(1, this.color + '0)');

        sparkleCtx.fillStyle = gradient;
        sparkleCtx.beginPath();
        sparkleCtx.arc(this.x, this.y, size * 4, 0, Math.PI * 2);
        sparkleCtx.fill();

        // Bright core
        sparkleCtx.fillStyle = this.color + Math.min(this.opacity * 1.2, 1) + ')';
        sparkleCtx.beginPath();
        sparkleCtx.arc(this.x, this.y, size * 0.6, 0, Math.PI * 2);
        sparkleCtx.fill();

        // Cross glow (star shape) for brighter sparkles
        if (this.opacity > 0.5) {
            sparkleCtx.strokeStyle = this.color + (this.opacity * 0.3) + ')';
            sparkleCtx.lineWidth = 0.5;
            const crossSize = size * 2;
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2 + this.phase * 0.1;
                sparkleCtx.beginPath();
                sparkleCtx.moveTo(this.x - Math.cos(angle) * crossSize, this.y - Math.sin(angle) * crossSize);
                sparkleCtx.lineTo(this.x + Math.cos(angle) * crossSize, this.y + Math.sin(angle) * crossSize);
                sparkleCtx.stroke();
            }
        }
    }
}

// ---- Init sparkles ----
function initSparkles(count = 150) {
    sparkles = [];
    for (let i = 0; i < count; i++) {
        const sparkle = new Sparkle();
        // Distribute evenly with random phases
        sparkle.phase = Math.random() * Math.PI * 2;
        sparkles.push(sparkle);
    }
}

// ---- Animation loop ----
function animateSparkles() {
    frameCount++;

    // Skip frames on mobile to reduce CPU usage
    if (frameCount % FRAME_SKIP !== 0) {
        requestAnimationFrame(animateSparkles);
        return;
    }

    sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);

    sparkles.forEach(sparkle => {
        sparkle.update();
        sparkle.draw();
    });

    requestAnimationFrame(animateSparkles);
}

// ---- Start ----
initSparkles(PARTICLE_COUNT);
animateSparkles();

// ---- Resize ----
window.addEventListener('resize', () => {
    sparkleCanvas.width = window.innerWidth;
    sparkleCanvas.height = window.innerHeight;
});

console.log(`✨ Glitter sparkles loaded (${PARTICLE_COUNT} particles, frameSkip=${FRAME_SKIP})`);
