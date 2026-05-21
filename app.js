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
            const bgEl = document.getElementById('dashboard-bg');
            if (bgEl) {
                bgEl.style.backgroundImage = isDay ? "url('background.jpeg')" : "url('backgroundDark.jpeg')";
            }
            
            const themeColor = isDay ? "#1e293b" : "#0b0f19";
            document.documentElement.style.backgroundColor = themeColor;
            document.body.style.backgroundColor = "transparent";
            
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
const bgEl = document.getElementById('dashboard-bg');
if (bgEl) {
    bgEl.style.backgroundImage = isInitNight ? "url('backgroundDark.jpeg')" : "url('background.jpeg')";
}
const initColor = isInitNight ? "#0b0f19" : "#1e293b";
document.documentElement.style.backgroundColor = initColor;
document.body.style.backgroundColor = "transparent";

updateDashboard();
setInterval(updateDashboard, 15 * 60 * 1000);

// ============================================================
// PRODUCTION WEBGL LIQUID GLASS ENGINE WITH CORNER REFRACTION
// ============================================================
(function webglLiquidGlassInit() {
    let glCanvas = document.getElementById('gl');
    if (!glCanvas) {
        glCanvas = document.createElement('canvas');
        glCanvas.id = 'gl';
        glCanvas.style.position = 'fixed';
        glCanvas.style.inset = '0';
        glCanvas.style.zIndex = '-1';
        glCanvas.style.pointerEvents = 'none';
        document.body.appendChild(glCanvas);
    }

    const renderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const textureLoader = new THREE.TextureLoader();

    const MAX_CARDS = 8;
    const cardCenters = new Float32Array(MAX_CARDS * 2);
    const cardSizes = new Float32Array(MAX_CARDS * 2);
    const cardRadii = new Float32Array(MAX_CARDS);

    let activeBgUrl = '';
    let currentTexture = null;

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        precision highp float;
        varying vec2 vUv;
        
        uniform vec2 uResolution;
        uniform int uCardCount;
        uniform vec2 uCardCenters[8];
        uniform vec2 uCardSizes[8];
        uniform float uCardRadii[8];
        
        uniform float uThickness;
        uniform float uIOR;
        uniform float uBlur;
        uniform float uSpecular;
        uniform float uTint;
        uniform sampler2D uBgTex;
        uniform float uBgAspect;

        float sdRoundedRect(vec2 p, vec2 halfSize, float r) {
            vec2 q = abs(p) - halfSize + r;
            return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
        }

        float surfaceHeight(float t) {
            float s = 1.0 - t;
            return pow(1.0 - s*s*s*s, 0.25);
        }

        vec3 sampleBg(vec2 screenUV) {
            float screenAspect = uResolution.x / uResolution.y;
            vec2 uv = screenUV;
            if (uBgAspect > screenAspect) {
                float s = screenAspect / uBgAspect;
                uv.x = uv.x * s + (1.0 - s) * 0.5;
            } else {
                float s = uBgAspect / screenAspect;
                uv.y = uv.y * s + (1.0 - s) * 0.5;
            }
            return texture2D(uBgTex, uv).rgb;
        }

        vec3 sampleBgBlurred(vec2 uv, float radius) {
            if (radius < 0.5) return sampleBg(uv);
            vec3 sum = vec3(0.0);
            vec2 px = 1.0 / uResolution;
            
            vec2 offsets[16];
            offsets[0]  = vec2(-0.94201, -0.39906); offsets[1]  = vec2( 0.94558, -0.76890);
            offsets[2]  = vec2(-0.09418, -0.92938); offsets[3]  = vec2( 0.34495,  0.29387);
            offsets[4]  = vec2(-0.91588, -0.45771); offsets[5]  = vec2(-0.81544,  0.48568);
            offsets[6]  = vec2(-0.38277, -0.56071); offsets[7]  = vec2(-0.12675,  0.84686);
            offsets[8]  = vec2( 0.89642,  0.41254); offsets[9]  = vec2( 0.18150, -0.30020);
            offsets[10] = vec2(-0.01445, -0.16001); offsets[11] = vec2( 0.59614,  0.71118);
            offsets[12] = vec2( 0.49742, -0.47280); offsets[13] = vec2( 0.80685,  0.04588);
            offsets[14] = vec2(-0.32490, -0.03965); offsets[15] = vec2(-0.60975,  0.06566);

            for (int i = 0; i < 16; i++) {
                sum += sampleBg(uv + offsets[i] * radius * px);
            }
            return sum / 16.0;
        }

        void main() {
            vec2 screenPx = vUv * uResolution;
            bool hitGlass = false;
            vec2 refractedUV = vUv;
            float combinedSd = 1e5;
            vec2 finalGrad = vec2(0.0);
            float finalDistFromEdge = 0.0;
            float finalBezel = 0.0;

            for (int i = 0; i < 8; i++) {
                if (i >= uCardCount) break;
                
                vec2 p = screenPx - uCardCenters[i];
                vec2 halfSize = uCardSizes[i] * 0.5;
                float sd = sdRoundedRect(p, halfSize, uCardRadii[i]);
                
                if (sd <= 0.0) {
                    hitGlass = true;
                    combinedSd = min(combinedSd, sd);
                    float distFromEdge = -sd;
                    
                    float bezel = min(uCardSizes[i].x * 0.18, min(uCardRadii[i], min(halfSize.x, halfSize.y)) - 1.0);
                    if (bezel <= 0.0) bezel = 10.0;
                    
                    float t = clamp(distFromEdge / bezel, 0.0, 1.0);
                    float h = surfaceHeight(t);
                    float dt = 0.001;
                    float h2 = surfaceHeight(min(t + dt, 1.0));
                    float dh = (h2 - h) / dt;
                    
                    float slopeAngle = atan(dh * (uThickness / bezel));
                    float sinR = sin(slopeAngle) / uIOR;
                    float thetaR = asin(clamp(sinR, -1.0, 1.0));
                    float displacement = h * uThickness * (tan(slopeAngle) - tan(thetaR));

                    vec2 grad;
                    float eps = 0.25;
                    grad.x = sdRoundedRect(p + vec2(eps, 0.0), halfSize, uCardRadii[i]) - sd;
                    grad.y = sdRoundedRect(p + vec2(0.0, eps), halfSize, uCardRadii[i]) - sd;
                    
                    if (length(grad) > 0.0) {
                        grad = normalize(grad);
                    } else {
                        grad = vec2(0.0);
                    }

                    vec2 offset = -grad * displacement / uResolution;
                    refractedUV = vUv + offset;
                    
                    finalGrad = grad;
                    finalDistFromEdge = distFromEdge;
                    finalBezel = bezel;
                    break;
                } else {
                    combinedSd = min(combinedSd, sd);
                }
            }

            if (!hitGlass) {
                if (combinedSd < 20.0) {
                    float shadowFalloff = exp(-combinedSd * combinedSd / 100.0);
                    gl_FragColor = vec4(0.0, 0.0, 0.0, shadowFalloff * 0.15);
                } else {
                    gl_FragColor = vec4(0.0);
                }
                return;
            }

            vec3 color = sampleBgBlurred(refractedUV, uBlur);

            vec2 lightDir = normalize(vec2(0.3, 0.5));
            float rimDot = max(0.0, dot(finalGrad, lightDir));
            float rimFalloff = 1.0 - smoothstep(0.0, finalBezel * 0.25, finalDistFromEdge);
            float specHighlight = pow(rimDot * rimFalloff, 2.5);
            color += vec3(specHighlight * uSpecular * 1.5);

            float innerRim = smoothstep(0.0, 0.5, finalDistFromEdge) * (1.0 - smoothstep(0.5, 1.5, finalDistFromEdge));
            color += vec3(innerRim * 0.35 * uSpecular);

            color = mix(color, vec3(0.0), uTint);
            float edgeAlpha = smoothstep(0.0, 1.0, finalDistFromEdge);
            gl_FragColor = vec4(color, edgeAlpha);
        }
    `;

    const uniforms = {
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCardCount: { value: 0 },
        uCardCenters: { value: cardCenters },
        uCardSizes: { value: cardSizes },
        uCardRadii: { value: cardRadii },
        uThickness: { value: 45.0 },     
        uIOR: { value: 1.65 },           
        uBlur: { value: 5.5 },
        uSpecular: { value: 0.75 },      
        uTint: { value: 0.2 },
        uBgTex: { value: new THREE.Texture() },
        uBgAspect: { value: 1.77 }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthTest: false
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    function synchronizeBackgroundTexture() {
        const bgElement = document.getElementById('dashboard-bg');
        if (!bgElement) return;

        const computedBg = window.getComputedStyle(bgElement).backgroundImage;
        const matches = computedBg.match(/url\((['"]?)(.*?)\1\)/);
        if (!matches || matches[2] === activeBgUrl) return;

        const newUrl = matches[2];
        activeBgUrl = newUrl;

        textureLoader.load(
            newUrl, 
            (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                currentTexture = tex;
                uniforms.uBgTex.value = tex;
                uniforms.uBgAspect.value = tex.image.width / tex.image.height;
            },
            undefined,
            (err) => {
                console.error("WebGL Texture Loader failed for URL:", newUrl, ". If you are viewing this via file://, WebGL textures will be blocked by CORS. Use a local server.");
            }
        );
    }

    function trackDOMCards() {
        const cards = document.querySelectorAll('.glass-card');
        const count = Math.min(cards.length, MAX_CARDS);
        uniforms.uCardCount.value = count;

        const windowHeight = window.innerHeight;

        cards.forEach((card, i) => {
            if (i >= MAX_CARDS) return;
            const rect = card.getBoundingClientRect();
            
            const centerX = rect.left + rect.width / 2;
            const centerY = windowHeight - (rect.top + rect.height / 2);

            cardCenters[i * 2] = centerX;
            cardCenters[i * 2 + 1] = centerY;
            cardSizes[i * 2] = rect.width;
            cardSizes[i * 2 + 1] = rect.height;
            cardRadii[i] = parseFloat(window.getComputedStyle(card).borderRadius) || 24;
            
            card.style.backdropFilter = 'none';
            card.style.webkitBackdropFilter = 'none';
            card.style.background = 'rgba(0, 0, 0, 0.15)';
        });
    }

    function animate() {
        requestAnimationFrame(animate);
        synchronizeBackgroundTexture();
        trackDOMCards();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    });

    animate();
})();