const RIVER_API = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14128870&parameterCd=00065&period=P1D&siteStatus=all";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=45.5492&longitude=-122.2341&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,is_day&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph";

function interpretWeather(code) {
    if (code === 0) return { icon: "sun", text: "Clear Sky" };
    if (code >= 1 && code <= 3) return { icon: "cloud-sun", text: "Partly Cloudy" };
    if (code >= 45 && code <= 48) return { icon: "cloud-fog", text: "Foggy" };
    if (code >= 51 && code <= 55) return { icon: "cloud-drizzle", text: "Drizzle" }; // Mapped to drizzle icon
    if (code >= 56 && code <= 67) return { icon: "cloud-rain", text: "Rainy" };
    if (code >= 71 && code <= 86) return { icon: "snowflake", text: "Snowing" };
    if (code >= 95) return { icon: "cloud-lightning", text: "Thunderstorm" };
    return { icon: "cloud", text: "Variable" };
}

function getWindDirection(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

// 4-Tier State Tracker: 3: Elite, 2: Good, 1: Suboptimal, 0: Bad
let riverStatus = 0;
let weatherStatus = 0;

function evaluateMasterStatus() {
    const banner = document.getElementById('master-status-banner');
    const statusLevel = Math.min(riverStatus, weatherStatus);
    
    // Reset structural utility classes before styling states
    banner.className = "w-full max-w-sm md:max-w-none md:w-[500px] mb-6 glass-card rounded-2xl px-6 py-4 text-center font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all duration-500";
    banner.style.borderWidth = "1px";

    if (statusLevel === 3) {
        // Tier 1: 🟢 Elite (Emerald Peak #0D7A5F)
        banner.style.backgroundColor = "rgba(13, 122, 95, 0.15)";
        banner.style.borderColor = "rgba(13, 122, 95, 0.4)";
        banner.style.color = "#10b981"; // Emerald-400
        banner.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5"></i> <span>Perfect day to go out! 🌟</span>`;
    } else if (statusLevel === 2) {
        // Tier 2: 🍏 Good (Vibrant Green #4CAF50)
        banner.style.backgroundColor = "rgba(76, 175, 80, 0.15)";
        banner.style.borderColor = "rgba(76, 175, 80, 0.4)";
        banner.style.color = "#4ade80"; // Green-400
        banner.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> <span>Good day to go out 👍</span>`;
    } else if (statusLevel === 1) {
        // Tier 3: 🟡 Suboptimal (Warning Yellow #FFC107)
        banner.style.backgroundColor = "rgba(255, 193, 7, 0.15)";
        banner.style.borderColor = "rgba(255, 193, 7, 0.4)";
        banner.style.color = "#fbbf24"; // Amber-400
        banner.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5"></i> <span>Adequate day to go out 👌</span>`;
    } else {
        // Tier 4: 🔴 Bad (Stop Red #E53935)
        banner.style.backgroundColor = "rgba(229, 57, 53, 0.15)";
        banner.style.borderColor = "rgba(229, 57, 53, 0.4)";
        banner.style.color = "#f87171"; // Red-400
        banner.innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 text-rose-400"></i> <span>Bad day to go out 😵</span>`;
    }
    
    // Initialize Lucide icons to render injected elements cleanly
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

async function updateDashboard() {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('timestamp').innerText = now;

    // Run both fetch tasks simultaneously to protect the application asynchronous flow
    const riverTask = async () => {
        try {
            const response = await fetch(RIVER_API, { mode: 'cors' });
            const data = await response.json();
            const records = data.value.timeSeries[0].values[0].value;
            
            const latestRecord = records[0];
            const gageHeight = parseFloat(latestRecord.value);

            if (records.length > 2) {
                const historicalValue = parseFloat(records[records.length - 1].value);
                const delta = gageHeight - historicalValue;
                const trendText = delta >= 0 ? `+${delta.toFixed(2)} ft (Rising)` : `${delta.toFixed(2)} ft (Falling)`;
                document.getElementById('river-trend').innerText = trendText;
            }

            const card = document.getElementById('status-card');
            const iconContainer = document.getElementById('status-icon-container');
            const text = document.getElementById('status-text');
            const accessNote = document.getElementById('river-access-note');
            
            document.getElementById('gauge-reading').innerText = `${gageHeight.toFixed(2)} ft`;
            card.classList.remove('animate-pulse');

            if (gageHeight < 15.0) {
                card.className = "glass-card bg-emerald-500/[0.08] rounded-2xl p-6 mb-4 border border-emerald-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-emerald-400";
                iconContainer.innerHTML = `<i data-lucide="sparkles" class="w-[72px] h-[72px]"></i>`;
                text.innerText = "Sand Island Fully Walkable"; 
                text.className = "text-sm font-semibold text-emerald-400";
                document.getElementById('trail-status').innerText = "Dry and open.";
                document.getElementById('island-status').innerText = "Easy wade/walk access.";
                accessNote.innerText = "Perfect! Sand Island is fully walkable. Enjoy the dunes. Use the beach trail to access the walk to the sand island. Use the lagoon trail to get right to the historic queer beach.";
                riverStatus = 3;
            } else if (gageHeight >= 15.0 && gageHeight < 18.0) {
                card.className = "glass-card bg-green-500/[0.08] rounded-2xl p-6 mb-4 border border-green-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-green-400";
                iconContainer.innerHTML = `<i data-lucide="check-circle" class="w-[72px] h-[72px]"></i>`;
                text.innerText = "Decent Mainland Access"; 
                text.className = "text-sm font-semibold text-green-400";
                document.getElementById('trail-status').innerText = "Muddy stretches.";
                document.getElementById('island-status').innerText = "Swim required for island.";
                accessNote.innerText = "Mainland is great! Use the beach trail for the normy (hetero beach) and the lagoon trail to get right to the historic queer beach.";
                riverStatus = 2;
            } else if (gageHeight >= 18.0 && gageHeight < 22.0) {
                card.className = "glass-card bg-amber-500/[0.08] rounded-2xl p-6 mb-4 border border-amber-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-amber-400";
                iconContainer.innerHTML = `<i data-lucide="alert-triangle" class="w-[72px] h-[72px]"></i>`;
                text.innerText = "Risky: High Water"; 
                text.className = "text-sm font-semibold text-amber-400";
                document.getElementById('trail-status').innerText = "Highly Submerged.";
                document.getElementById('island-status').innerText = "Island access unavailable.";
                accessNote.innerHTML = "High waters! Use High Water Trail to access the <i>Bear Bluffs</i>; look for small sand pockets or clearings to relax in.";
                riverStatus = 1;
            } else {
                card.className = "glass-card bg-rose-500/[0.08] rounded-2xl p-6 mb-4 border border-rose-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-rose-400";
                iconContainer.innerHTML = `<i data-lucide="waves" class="w-[72px] h-[72px]"></i>`;
                text.innerText = "Bad: Beach is Submerged"; 
                text.className = "text-sm font-semibold text-rose-400";
                document.getElementById('trail-status').innerText = "Underwater.";
                document.getElementById('island-status').innerText = "Dangerous currents.";
                accessNote.innerText = "Washout! Beach is submerged; avoid unless you like muddy tree lines.";
                riverStatus = 0;
            }
        } catch (e) {
            console.error("Failed to parse river telemetry:", e);
            document.getElementById('status-text').innerText = "River Data Error";
            riverStatus = 0;
        }
    };

    const weatherTask = async () => {
        try {
            const response = await fetch(WEATHER_API, { mode: 'cors' });
            const data = await response.json();
            const current = data.current;
            const dailyHigh = Math.round(data.daily.temperature_2m_max[0]);
            const dailyLow = Math.round(data.daily.temperature_2m_min[0]);

            const isDay = current.is_day !== undefined ? current.is_day === 1 : (new Date().getHours() >= 6 && new Date().getHours() < 20);
            const bgUrl = isDay ? "url('background.jpeg')" : "url('backgroundDark.jpeg')";
            const tint = "rgba(15, 23, 42, 0.45)";

            if (bgEl) bgEl.style.backgroundImage = `linear-gradient(${tint}, ${tint}), ${bgUrl}`;

            const weather = interpretWeather(current.weather_code);
            const windDir = getWindDirection(current.wind_direction_10m);
            const wCard = document.getElementById('weather-card');
            const wIconContainer = document.getElementById('weather-icon-container');
            const wText = document.getElementById('weather-text');
            
            const temperature = dailyHigh;
            const code = current.weather_code;

            wCard.classList.remove('animate-pulse');
            
            // Weather logic checks based on WMO codes
            const isBadPrecipitation = (code >= 56 && code <= 67) || (code >= 71 && code <= 86) || (code >= 95); // Rain, Snow, Thunderstorm
            const isSuboptimalPrecipitation = (code >= 51 && code <= 55); // Light showers / drizzle

            if (temperature < 68 || temperature > 101 || isBadPrecipitation) {
                // Tier 4: 🔴 Bad (Stop Red)
                wCard.className = "glass-card bg-rose-500/[0.08] rounded-2xl p-6 mb-4 border border-rose-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-rose-400";
                wText.className = "text-sm font-semibold text-rose-400";
                wText.innerText = "High Today Is";
                weatherStatus = 0;
            } else if ((temperature >= 68 && temperature <= 73) || isSuboptimalPrecipitation) {
                // Tier 3: 🟡 Suboptimal (Warning Yellow)
                wCard.className = "glass-card bg-amber-500/[0.08] rounded-2xl p-6 mb-4 border border-amber-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-amber-400";
                wText.className = "text-sm font-semibold text-amber-400";
                wText.innerText = "High Today Is";
                weatherStatus = 1;
            } else if (temperature >= 74 && temperature <= 81) {
                // Tier 2: 🍏 Good (Vibrant Green)
                wCard.className = "glass-card bg-green-500/[0.08] rounded-2xl p-6 mb-4 border border-green-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-green-400";
                wText.className = "text-sm font-semibold text-green-400";
                wText.innerText = "High Today Is";
                weatherStatus = 2;
            } else {
                // Tier 1: 🟢 Elite (Emerald Peak)
                wCard.className = "glass-card bg-emerald-500/[0.08] rounded-2xl p-6 mb-4 border border-emerald-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
                wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-emerald-400";
                wText.className = "text-sm font-semibold text-emerald-400";
                wText.innerText = "High Today Is";
                weatherStatus = 3;
            }

            wIconContainer.innerHTML = `<i data-lucide="${weather.icon}" class="w-[72px] h-[72px]"></i>`;
            document.getElementById('weather-reading').innerText = `${dailyHigh}°F`;
            document.getElementById('wind-full').innerText = `${Math.round(current.wind_speed_10m)} mph, ${current.wind_direction_10m}° (${windDir})`;

            document.getElementById('weather-current').innerText = `${Math.round(current.temperature_2m)}°F`;
            document.getElementById('weather-feels').innerText = `${Math.round(current.apparent_temperature)}°F`;
            document.getElementById('weather-humidity').innerText = `${current.relative_humidity_2m}%`;
            document.getElementById('weather-uv').innerText = current.uv_index.toFixed(1);
            const heatWarning = dailyHigh > 95 ? " ⚠️ HIGH TEMP WARNING: Stay hydrated and seek shade!" : "";
            document.getElementById('weather-access-note').innerText = `Range: ${dailyLow}°F - ${dailyHigh}°F. Note: Under 80°F may feel brisk in the Gorge wind.${heatWarning}`;

        } catch (e) {
            console.error("Failed to parse weather data:", e);
            document.getElementById('weather-text').innerText = "Weather Data Error";
            weatherStatus = 0;
        }
    };

    // Explicitly await execution across both API requests before updating visual flags
    await Promise.all([riverTask(), weatherTask()]);
    evaluateMasterStatus();
}

document.addEventListener('DOMContentLoaded', () => {
    const weatherBtn = document.getElementById('toggle-more-conditions');
    const weatherShelf = document.getElementById('extended-weather-shelf');
    const weatherBtnText = document.getElementById('toggle-btn-text');
    const weatherIcon = document.getElementById('toggle-btn-icon');

    if (weatherBtn && weatherShelf) {
        weatherBtn.addEventListener('click', () => {
            const isOpen = weatherShelf.classList.toggle('open');
            weatherBtnText.innerText = isOpen ? "LESS CONDITIONS" : "MORE CONDITIONS";
            weatherIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
        });
    }

    const riverBtn = document.getElementById('toggle-river-conditions');
    const riverShelf = document.getElementById('extended-river-shelf');
    const riverBtnText = document.getElementById('river-btn-text');
    const riverIcon = document.getElementById('river-btn-icon');

    if (riverBtn && riverShelf) {
        riverBtn.addEventListener('click', () => {
            const isOpen = riverShelf.classList.toggle('open');
            riverBtnText.innerText = isOpen ? "LESS CONDITIONS" : "MORE CONDITIONS";
            riverIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
        });
    }

    const parkBtn = document.getElementById('toggle-park-info');
    const parkShelf = document.getElementById('extended-park-shelf');
    const parkBtnText = document.getElementById('park-btn-text');
    const parkIcon = document.getElementById('park-btn-icon');

    if (parkBtn && parkShelf) {
        parkBtn.addEventListener('click', () => {
            const isOpen = parkShelf.classList.toggle('open');
            parkBtnText.innerText = isOpen ? "LESS DETAILS" : "MORE DETAILS";
            parkIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
        });
    }
});

const initHour = new Date().getHours();
const isInitNight = initHour < 6 || initHour >= 20;

if (isInitNight) {
    const nightUrl = "url('backgroundDark.jpeg')";
    const tint = "rgba(15, 23, 42, 0.45)";
    if (bgEl) bgEl.style.backgroundImage = `linear-gradient(${tint}, ${tint}), ${nightUrl}`;
}

updateDashboard();
setInterval(updateDashboard, 15 * 60 * 1000);