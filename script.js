/* script.js - Glass Weather app */
/* Uses WeatherAPI (https://www.weatherapi.com/) 
   API Key provided by user.
*/

const API_KEY = 'ef9e4848bddc4f988bc73557253011';
const SEARCH_ENDPOINT = 'https://api.weatherapi.com/v1/search.json';
const CURRENT_ENDPOINT = 'https://api.weatherapi.com/v1/current.json';

const cityInput = document.getElementById('cityInput');
const suggestionsEl = document.getElementById('suggestions');
const weatherPanel = document.getElementById('weatherPanel');
const weatherIcon = document.getElementById('weatherIcon');
const tempC = document.getElementById('tempC');
const conditionText = document.getElementById('conditionText');
const cityName = document.getElementById('cityName');
const feelsLike = document.getElementById('feelsLike');
const wind = document.getElementById('wind');
const humidity = document.getElementById('humidity');
const localTime = document.getElementById('localTime');
const bgLayer = document.getElementById('bgLayer');
const useLocationBtn = document.getElementById('useLocationBtn');

let suggestionItems = [];
let activeIndex = -1;
let currentFetchToken = 0;

/* Utility: debounce */
function debounce(fn, wait = 300){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* sanitize suggestion text for display */
function formatLocation(item){
  // item has name, region, country
  if (!item) return '';
  const parts = [item.name, item.region].filter(Boolean);
  return `${parts.join(', ')} • ${item.country}`;
}

/* render suggestions */
function renderSuggestions(list){
  suggestionsEl.innerHTML = '';
  suggestionItems = list;
  activeIndex = -1;

  if (!list || list.length === 0){
    suggestionsEl.classList.add('hidden');
    return;
  }
  suggestionsEl.classList.remove('hidden');

  list.forEach((it, idx) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.index = idx;
    li.innerText = formatLocation(it);
    li.addEventListener('click', () => {
      selectSuggestion(idx);
    });
    suggestionsEl.appendChild(li);
  });
}

/* keyboard navigation in suggestions */
cityInput.addEventListener('keydown', (ev) => {
  if (suggestionsEl.classList.contains('hidden')) return;
  const items = suggestionsEl.querySelectorAll('li');

  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    updateActiveItem(items);
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    updateActiveItem(items);
  } else if (ev.key === 'Enter') {
    ev.preventDefault();
    if (activeIndex >= 0) selectSuggestion(activeIndex);
    else if (items.length === 1) selectSuggestion(0);
  } else if (ev.key === 'Escape') {
    hideSuggestions();
  }
});

function updateActiveItem(items){
  items.forEach((li, i) => {
    const isActive = i === activeIndex;
    li.setAttribute('aria-selected', isActive ? 'true' : 'false');
    // scroll into view when necessary
    if (isActive) li.scrollIntoView({ block: 'nearest' });
  });
}

/* hide suggestions */
function hideSuggestions(){
  suggestionsEl.classList.add('hidden');
  suggestionItems = [];
  activeIndex = -1;
}

/* when suggestion selected */
function selectSuggestion(index){
  const item = suggestionItems[index];
  if (!item) return;
  cityInput.value = `${item.name}${item.region ? ', ' + item.region : ''}, ${item.country}`;
  hideSuggestions();
  fetchWeatherFor(item.name);
}

/* Search API call for typeahead */
async function searchCities(query, token){
  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('q', query);
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error('Search failed');
    const data = await resp.json();
    // token check to ensure last typed fetch wins
    if (token !== currentFetchToken) return;
    renderSuggestions(data.slice(0, 8)); // cap suggestions
  } catch (err) {
    console.error('search error', err);
    renderSuggestions([]);
  }
}

/* Debounced handler */
const handleType = debounce(() => {
  const q = cityInput.value.trim();
  if (q.length < 2) {
    hideSuggestions();
    return;
  }
  currentFetchToken += 1;
  const token = currentFetchToken;
  searchCities(q, token);
}, 300);

/* input event */
cityInput.addEventListener('input', (e) => {
  handleType();
});

/* click outside to hide suggestions */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-block')) {
    hideSuggestions();
  }
});

/* fetch weather for a city */
async function fetchWeatherFor(query){
  try {
    showLoadingState(true);
    const url = new URL(CURRENT_ENDPOINT);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('q', query);
    url.searchParams.set('aqi', 'no');
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error('Weather fetch failed');
    const data = await resp.json();
    displayWeather(data);
  } catch (err) {
    console.error(err);
    alert('Could not fetch weather. Please check the city name or your network.');
  } finally {
    showLoadingState(false);
  }
}

/* show/hide loading state (simple) */
function showLoadingState(on){
  if (on) {
    // could show a spinner — for now, change placeholder
    cityInput.placeholder = 'Loading...';
    cityInput.disabled = true;
  } else {
    cityInput.placeholder = 'Enter city name (e.g., Mumbai)';
    cityInput.disabled = false;
  }
}

/* Display weather data into UI */
function displayWeather(payload){
  if (!payload || !payload.location || !payload.current) return;
  const loc = payload.location;
  const cur = payload.current;
  const cond = cur.condition || {};

  // icon: condition.icon may be //cdn... -> ensure https:
  let iconUrl = cond.icon || '';
  if (iconUrl && iconUrl.startsWith('//')) iconUrl = 'https:' + iconUrl;

  weatherIcon.src = iconUrl;
  weatherIcon.alt = cond.text || 'Weather icon';
  tempC.innerText = `${Math.round(cur.temp_c)}°C`;
  conditionText.innerText = cond.text || '—';
  cityName.innerText = `${loc.name}${loc.region ? ', ' + loc.region : ''}, ${loc.country}`;
  feelsLike.innerText = `${Math.round(cur.feelslike_c)}°C`;
  wind.innerText = `${cur.wind_kph} kph ${cur.wind_dir || ''}`;
  humidity.innerText = `${cur.humidity}%`;
  localTime.innerText = loc.localtime || '';

  weatherPanel.classList.remove('hidden');

  // dynamic background and glass tint based on temperature and day/night
  applyDynamicBackground(cur.temp_c, cur.is_day);
}

/* dynamic background gradient based on temp and day/night */
function applyDynamicBackground(tempCVal, isDay) {
  // choose colors based on temp thresholds
  const t = Number(tempCVal);
  let gradient;
  if (isDay === 0 || isDay === '0') {
    // night tones
    gradient = 'radial-gradient(circle at 10% 10%, rgba(20,28,72,0.95), rgba(6,12,34,0.95))';
  } else {
    if (t <= 0) gradient = 'radial-gradient(circle at 10% 10%, rgba(10,45,85,0.95), rgba(0,20,40,0.95))';
    else if (t <= 15) gradient = 'radial-gradient(circle at 10% 10%, rgba(34,83,140,0.95), rgba(6,24,55,0.95))';
    else if (t <= 28) gradient = 'radial-gradient(circle at 10% 10%, rgba(20,140,180,0.95), rgba(3,80,105,0.95))';
    else gradient = 'radial-gradient(circle at 10% 10%, rgba(255,120,80,0.95), rgba(155,45,0,0.95))';
  }
  // subtle animated color variation
  bgLayer.style.background = gradient;
}

/* Use browser geolocation to fetch by coords */
useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported by your browser.');
    return;
  }
  useLocationBtn.disabled = true;
  useLocationBtn.innerText = 'Finding location...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      // WeatherAPI supports lat,long as "q" param like "lat,lon"
      await fetchWeatherFor(`${latitude},${longitude}`);
    } catch (err) {
      console.error(err);
      alert('Failed to get weather for your location.');
    } finally {
      useLocationBtn.disabled = false;
      useLocationBtn.innerText = 'Use my location';
    }
  }, (err) => {
    alert('Location permission denied or unavailable.');
    useLocationBtn.disabled = false;
    useLocationBtn.innerText = 'Use my location';
  }, { timeout: 10000 });
});

/* initial small demo: try to show a default city (optional) */
(function init(){
  // optional: show default city weather on load (comment out if not desired)
  // fetchWeatherFor('New Delhi');
})();
