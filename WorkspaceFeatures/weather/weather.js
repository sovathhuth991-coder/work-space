// ============================================================
// WEATHER MODULE – Free wttr.in API (no key required)
// ============================================================

const WEATHER_STORAGE_KEY = 'weatherData';
const CITY_STORAGE_KEY = 'weatherCity';
const DEFAULT_CITY = 'London';

// ─── State ────────────────────────────────────────────────
let weatherData = null;
let currentCity = localStorage.getItem(CITY_STORAGE_KEY) || DEFAULT_CITY;

// ─── DOM refs (will be set when views render) ────────────
let viewContainer = null;
let widgetContainer = null;

// ─── Fetch Weather ────────────────────────────────────────
async function fetchWeather(city = currentCity) {
    if (!city || city.trim() === '') city = DEFAULT_CITY;
    currentCity = city.trim();
    localStorage.setItem(CITY_STORAGE_KEY, currentCity);

    const url = `https://wttr.in/${encodeURIComponent(currentCity)}?format=j1`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Parse the response into a clean structure
        weatherData = {
            city: data.nearest_area?.[0]?.areaName?.[0]?.value || currentCity,
            country: data.nearest_area?.[0]?.country?.[0]?.value || '',
            _timestamp: Date.now(), // ← NEW: store when fetched
            _offline: false,
            current: {
                temp: data.current_condition?.[0]?.temp_C || '--',
                condition: data.current_condition?.[0]?.weatherDesc?.[0]?.value || 'Unknown',
                icon: mapWeatherIcon(data.current_condition?.[0]?.weatherCode || 0),
                wind: data.current_condition?.[0]?.windspeedKmph || '0',
                humidity: data.current_condition?.[0]?.humidity || '0'
            },
            forecast: (data.weather || []).slice(0, 7).map(day => ({
                date: day.date,
                max: day.maxtempC || '--',
                min: day.mintempC || '--',
                condition: day.hourly?.[0]?.weatherDesc?.[0]?.value || 'Unknown',
                icon: mapWeatherIcon(day.hourly?.[0]?.weatherCode || 0)
            }))
        };

        // Cache in localStorage
        localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(weatherData));
        return weatherData;
    } catch (error) {
        // Try to load cached data first
        const cached = localStorage.getItem(WEATHER_STORAGE_KEY);
        if (cached) {
            weatherData = JSON.parse(cached);
            weatherData._offline = true;
            console.warn('Weather fetch failed, using cached data:', error.message);
            return weatherData;
        }
        // No cache available, show error
        console.error('Weather fetch error (no cache available):', error);
        throw error;
    }
}

// ─── Map weather codes to emojis ──────────────────────────
function mapWeatherIcon(code) {
    // wttr.in weather codes: https://www.wttr.in/weather-codes.txt
    const map = {
        113: '☀️', // Sunny
        116: '⛅', // Partly cloudy
        119: '☁️', // Cloudy
        122: '☁️', // Overcast
        143: '🌫️', // Mist
        176: '🌦️', // Patchy rain
        179: '🌨️', // Patchy snow
        182: '🌧️', // Patchy sleet
        185: '🌧️', // Patchy freezing drizzle
        200: '⛈️', // Thunderstorm
        227: '❄️', // Blowing snow
        230: '❄️', // Blizzard
        248: '🌫️', // Fog
        260: '🌫️', // Freezing fog
        263: '🌦️', // Patchy light drizzle
        266: '🌧️', // Light drizzle
        281: '🌧️', // Freezing drizzle
        284: '🌧️', // Heavy freezing drizzle
        293: '🌦️', // Patchy light rain
        296: '🌧️', // Light rain
        299: '🌧️', // Moderate rain at times
        302: '🌧️', // Moderate rain
        305: '🌧️', // Heavy rain at times
        308: '🌧️', // Heavy rain
        311: '🌨️', // Light freezing rain
        314: '🌨️', // Moderate freezing rain
        317: '🌨️', // Heavy freezing rain
        320: '🌨️', // Light snow
        323: '🌨️', // Moderate snow
        326: '🌨️', // Heavy snow
        329: '🌨️', // Snow showers
        332: '🌨️', // Heavy snow showers
        335: '🌨️', // Snow showers
        338: '❄️', // Heavy snow
        350: '🌧️', // Freezing drizzle
        353: '🌦️', // Light rain shower
        356: '🌧️', // Moderate rain shower
        359: '🌧️', // Heavy rain shower
        362: '🌨️', // Light sleet shower
        365: '🌨️', // Moderate sleet shower
        368: '🌨️', // Heavy sleet shower
        371: '🌨️', // Light snow shower
        374: '🌨️', // Moderate snow shower
        377: '🌨️', // Heavy snow shower
        386: '⛈️', // Thunderstorm with hail
        389: '⛈️', // Thunderstorm with rain
        392: '⛈️', // Thunderstorm with snow
        395: '⛈️', // Thunderstorm with hail
    };
    return map[code] || '🌤️';
}

// ─── Format "Last Updated" ────────────────────────────────
function getLastUpdatedString(timestamp) {
    if (!timestamp) return 'Unknown';
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// ─── Render Full Weather View ─────────────────────────────
function renderWeatherView() {
    const container = document.getElementById('weather-view-container');
    if (!container) return;

    if (!weatherData) {
        container.innerHTML = `<div class="weather-loading">🌍 Loading weather...</div>`;
        fetchWeather(currentCity).then(() => renderWeatherView()).catch(() => {
            container.innerHTML = `<div class="weather-error">⚠️ Could not load weather. Please try again.</div>`;
        });
        return;
    }

    const w = weatherData;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const lastUpdated = getLastUpdatedString(w._timestamp);

    container.innerHTML = `
        <div class="weather-view-container">
            <!-- Header -->
            <div class="weather-header">
                <div class="weather-city-input">
                    <input type="text" id="weatherCityInput" value="${escapeHtml(currentCity)}" placeholder="Enter city..." />
                    <button id="weatherUpdateBtn">Update</button>
                </div>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="font-size:0.75rem;color:var(--text-muted);">
                        🕐 Updated: <span id="lastUpdatedLabel">${lastUpdated}</span>
                    </span>
                    <button class="weather-refresh-btn" id="weatherRefreshBtn">⟳ Refresh</button>
                </div>
            </div>

            <!-- Current Weather -->
            <div class="weather-current">
                <div class="left">
                    <span style="font-size:3.5rem;">${w.current.icon}</span>
                    <div>
                        <div class="temp">${w.current.temp}°C</div>
                        <div class="condition">${w.current.condition}</div>
                    </div>
                </div>
                <div class="details">
                    <span>💨 ${w.current.wind} km/h</span>
                    <span>💧 ${w.current.humidity}%</span>
                    <span style="font-size:0.8rem;margin-top:4px;">${w.city}, ${w.country}</span>
                </div>
            </div>

            <!-- 7‑Day Forecast -->
            <h3 style="margin-bottom:12px;color:var(--text-secondary);">7‑Day Forecast</h3>
            <div class="weather-forecast-grid">
                ${w.forecast.map((day, index) => {
                    const dayName = days[(today + index) % 7];
                    return `
                        <div class="weather-day-card">
                            <div class="day-name">${dayName}</div>
                            <div class="day-icon">${day.icon}</div>
                            <div class="day-temp">${day.max}° <small>${day.min}°</small></div>
                            <div class="day-condition">${day.condition}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // ─── Bind events ──────────────────────────────────────
    document.getElementById('weatherUpdateBtn').addEventListener('click', async () => {
        const cityInput = document.getElementById('weatherCityInput');
        const newCity = cityInput.value.trim();
        if (newCity && newCity !== currentCity) {
            container.innerHTML = `<div class="weather-loading">🌍 Loading weather for ${escapeHtml(newCity)}...</div>`;
            try {
                await fetchWeather(newCity);
                renderWeatherView();
            } catch {
                container.innerHTML = `<div class="weather-error">⚠️ City not found. Please try again.</div>`;
            }
        }
    });

    document.getElementById('weatherRefreshBtn').addEventListener('click', async () => {
        container.innerHTML = `<div class="weather-loading">⟳ Refreshing...</div>`;
        try {
            await fetchWeather(currentCity);
            renderWeatherView();
            // Update the "last updated" label after refresh
            const label = document.getElementById('lastUpdatedLabel');
            if (label) label.textContent = getLastUpdatedString(weatherData._timestamp);
        } catch {
            container.innerHTML = `<div class="weather-error">⚠️ Could not refresh. Please try again.</div>`;
        }
    });

    // Enter key on input
    document.getElementById('weatherCityInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('weatherUpdateBtn').click();
    });
}

// ─── Render Dashboard Widget ──────────────────────────────
function renderWeatherWidget() {
    const container = document.getElementById('weatherWidgetContainer');
    if (!container) return;

    if (!weatherData) {
        container.innerHTML = `<div class="weather-widget" onclick="switchView('weather-view')" style="justify-content:center;color:var(--text-muted);">🌍 Loading weather...</div>`;
        return;
    }

    const w = weatherData;
    const lastUpdated = getLastUpdatedString(w._timestamp);
    const offlineLabel = w._offline ? ' · offline' : '';

    container.innerHTML = `
        <div class="weather-widget" onclick="switchView('weather-view')" role="button" tabindex="0" aria-label="Open weather forecast">
            <div>
                <span class="widget-icon">${w.current.icon}</span>
            </div>
            <div class="widget-weather-summary">
                <span class="widget-temp">${w.current.temp}°C</span>
                <span class="widget-condition">${w.current.condition}</span>
                <span class="widget-location">📍 ${w.city}</span>
                <span class="widget-updated">Updated ${lastUpdated}${offlineLabel}</span>
            </div>
        </div>
    `;
}

// ─── Initialise Weather on Dashboard ──────────────────────
function initWeather() {
    // Render widget if container exists
    const widgetContainer = document.getElementById('weatherWidgetContainer');
    if (widgetContainer) {
        // Load cached data first
        const cached = localStorage.getItem(WEATHER_STORAGE_KEY);
        if (cached) {
            weatherData = JSON.parse(cached);
            weatherData._offline = true;
            renderWeatherWidget();
        } else {
            renderWeatherWidget(); // shows loading
        }
        // Fetch fresh data in background
        fetchWeather(currentCity).then(() => {
            renderWeatherWidget();
            // Also update the full view if it's currently active
            if (document.getElementById('weather-view')?.classList.contains('active')) {
                renderWeatherView();
            }
        }).catch(() => {
            if (weatherData?._offline) {
                renderWeatherWidget();
            }
        });
    }

    // If weather-view is active on load, render it
    const viewContainer = document.getElementById('weather-view-container');
    if (viewContainer && document.getElementById('weather-view')?.classList.contains('active')) {
        renderWeatherView();
    }
}

// ─── Expose ─────────────────────────────────────────────────
window.fetchWeather = fetchWeather;
window.renderWeatherView = renderWeatherView;
window.renderWeatherWidget = renderWeatherWidget;
window.initWeather = initWeather;
window.getLastUpdatedString = getLastUpdatedString;

// Auto‑initialise on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // We'll call initWeather after the dashboard and view are set up.
    // But we'll also listen for view changes to re‑render if needed.
    document.addEventListener('viewChanged', (e) => {
        if (e.detail.viewId === 'weather-view') {
            // If we don't have fresh data, fetch
            if (!weatherData) {
                fetchWeather(currentCity).then(() => renderWeatherView());
            } else {
                renderWeatherView();
            }
        }
    });
});

console.log('🌤️ Weather module loaded (with timestamp).');
