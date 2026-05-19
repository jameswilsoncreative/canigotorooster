// Target Endpoints (Rooster Rock Coordinates: 45.5492, -122.2341)
const RIVER_API = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14128870&parameterCd=00065&period=P1D&siteStatus=all";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=45.5492&longitude=-122.2341&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index&temperature_unit=fahrenheit&wind_speed_unit=mph";

function interpretWeather(code) {
    if (code === 0) return { icon: "sun", text: "Clear Sky" };
    if (code >= 1 && code <= 3) return { icon: "cloud-sun", text: "Partly Cloudy" };
    if (code >= 45 && code <= 48) return { icon: "cloud-fog", text: "Foggy" };
    if (code >= 51 && code <= 67) return { icon: "cloud-rain", text: "Rainy" };
    if (code >= 71 && code <= 86) return { icon: "snowflake", text: "Snowing" };
    if (code >= 95) return { icon: "cloud-lightning", text: "Thunderstorm" };
    return { icon: "cloud", text: "Variable" };
}

function getWindDirection(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

let riverGo = false;
let weatherGo = false;

function evaluateMasterStatus() {
    const banner = document.getElementById('master-status-banner');
    
    if (riverGo && weatherGo) {
        banner.className = "w-full max-w-sm md:max-w-none md:w-[500px] mb-6 glass-card bg-emerald-500/[0.12] rounded-2xl px-6 py-4 border border-emerald-500/30 text-center font-semibold tracking-wide flex items-center justify-center gap-2 text-emerald-400 shadow-lg shadow-emerald-950/20";
        banner.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i> <span>Good day to go out 👍</span>`;
    } else {
        banner.className = "w-full max-w-sm md:max-w-none md:w-[500px] mb-6 glass-card bg-rose-500/[0.12] rounded-2xl px-6 py-4 border border-rose-500/30 text-center font-semibold tracking-wide flex items-center justify-center gap-2 text-rose-400 shadow-lg shadow-rose-950/20";
        banner.innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 text-rose-400"></i> <span>Bad day to go out 😵</span>`;
    }
    lucide.createIcons();
}

async function updateDashboard() {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('timestamp').innerText = now;

    // 1. UPDATE RIVER CONDITIONS
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
        
        document.getElementById('gauge-reading').innerText = `${gageHeight.toFixed(2)} ft`;
        card.classList.remove('animate-pulse');

        if (gageHeight < 13.0) {
            card.className = "glass-card bg-emerald-500/[0.08] rounded-2xl p-6 mb-4 border border-emerald-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-emerald-400";
            iconContainer.innerHTML = `<i data-lucide="sun" class="w-[72px] h-[72px]"></i>`;
            text.innerText = "Perfect Beach Day!"; 
            text.className = "text-sm font-semibold text-emerald-400";
            document.getElementById('trail-status').innerText = "Dry and open.";
            document.getElementById('island-status').innerText = "Easy wade/walk access.";
            riverGo = true;
        } else if (gageHeight >= 13.0 && gageHeight < 17.5) {
            card.className = "glass-card bg-amber-500/[0.08] rounded-2xl p-6 mb-4 border border-amber-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-amber-400";
            iconContainer.innerHTML = `<i data-lucide="alert-circle" class="w-[72px] h-[72px]"></i>`;
            text.innerText = "Limited Beach Space"; 
            text.className = "text-sm font-semibold text-amber-400";
            document.getElementById('trail-status').innerText = "Muddy stretches.";
            document.getElementById('island-status').innerText = "Deep wade or short swim.";
            riverGo = false;
        } else {
            card.className = "glass-card bg-rose-500/[0.08] rounded-2xl p-6 mb-4 border border-rose-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            iconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-rose-400";
            iconContainer.innerHTML = `<i data-lucide="waves" class="w-[72px] h-[72px]"></i>`;
            text.innerText = "Beach is Submerged"; 
            text.className = "text-sm font-semibold text-rose-400";
            document.getElementById('trail-status').innerText = "Underwater.";
            document.getElementById('island-status').innerText = "Dangerous currents.";
            riverGo = false;
        }
    } catch (e) {
        console.error("Failed to parse river telemetry:", e);
        document.getElementById('status-text').innerText = "River Data Error";
        riverGo = false;
    }

    // 2. UPDATE METEOROLOGICAL CONDITIONS
    try {
        const response = await fetch(WEATHER_API, { mode: 'cors' });
        const data = await response.json();
        const current = data.current;
        
        const weather = interpretWeather(current.weather_code);
        const windDir = getWindDirection(current.wind_direction_10m);
        const wCard = document.getElementById('weather-card');
        const wIconContainer = document.getElementById('weather-icon-container');
        const wText = document.getElementById('weather-text');
        
        const temperature = Math.round(current.temperature_2m);
        const isClear = current.weather_code <= 3;

        wCard.classList.remove('animate-pulse');
        
        if (temperature >= 80 && isClear) {
            wCard.className = "glass-card bg-emerald-500/[0.08] rounded-2xl p-6 mb-4 border border-emerald-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-emerald-400";
            wText.className = "text-sm font-semibold text-emerald-400";
            wText.innerText = `${weather.text} (Warm enough!)`;
            weatherGo = true;
        } 
        else if (temperature >= 73 && temperature < 80 && isClear) {
            wCard.className = "glass-card bg-amber-500/[0.08] rounded-2xl p-6 mb-4 border border-amber-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-amber-400";
            wText.className = "text-sm font-semibold text-amber-400";
            wText.innerText = `${weather.text} (A bit brisk)`;
            weatherGo = false;
        } 
        else {
            wCard.className = "glass-card bg-rose-500/[0.08] rounded-2xl p-6 mb-4 border border-rose-500/20 text-center flex flex-col items-center justify-center min-h-[200px]";
            wIconContainer.className = "w-[72px] h-[72px] flex items-center justify-center mb-2 text-rose-400";
            wText.className = "text-sm font-semibold text-rose-400";
            wText.innerText = !isClear ? `${weather.text} (Inclement Weather)` : `${weather.text} (Bring a blanket)`;
            weatherGo = false;
        }

        wIconContainer.innerHTML = `<i data-lucide="${weather.icon}" class="w-[72px] h-[72px]"></i>`;
        document.getElementById('weather-reading').innerText = `${temperature}°F`;
        document.getElementById('wind-speed').innerText = `${Math.round(current.wind_speed_10m)} mph`;
        document.getElementById('wind-dir').innerText = `${current.wind_direction_10m}° (${windDir})`;

        document.getElementById('weather-feels').innerText = `${Math.round(current.apparent_temperature)}°F`;
        document.getElementById('weather-humidity').innerText = `${current.relative_humidity_2m}%`;
        document.getElementById('weather-uv').innerText = current.uv_index.toFixed(1);

    } catch (e) {
        console.error("Failed to parse weather data:", e);
        document.getElementById('weather-text').innerText = "Weather Data Error";
        weatherGo = false;
    }

    evaluateMasterStatus();
}

// Collapsible Event System Handler
document.addEventListener('DOMContentLoaded', () => {
    const weatherBtn = document.getElementById('toggle-more-conditions');
    const weatherShelf = document.getElementById('extended-weather-shelf');
    const weatherBtnText = document.getElementById('toggle-btn-text');
    const weatherIcon = document.getElementById('toggle-btn-icon');

    weatherBtn.addEventListener('click', () => {
        const isOpen = weatherShelf.classList.toggle('open');
        weatherBtnText.innerText = isOpen ? "LESS CONDITIONS" : "MORE CONDITIONS";
        weatherIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
    });

    const riverBtn = document.getElementById('toggle-river-conditions');
    const riverShelf = document.getElementById('extended-river-shelf');
    const riverBtnText = document.getElementById('river-btn-text');
    const riverIcon = document.getElementById('river-btn-icon');

    riverBtn.addEventListener('click', () => {
        const isOpen = riverShelf.classList.toggle('open');
        riverBtnText.innerText = isOpen ? "LESS CONDITIONS" : "MORE CONDITIONS";
        riverIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
    });
});

updateDashboard();
setInterval(updateDashboard, 15 * 60 * 1000);