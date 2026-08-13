const API_BASE_URL = "";
const REFRESH_INTERVAL_MS = 3000;

const totalVotesEl = document.getElementById("total-votes");
const resultsBarsEl = document.getElementById("results-bars");
const hourlyBarsEl = document.getElementById("hourly-bars");

function buildBarRow(label, percentage) {
  const row = document.createElement("div");
  row.className = "result-row";

  const labelEl = document.createElement("div");
  labelEl.className = "result-label";
  labelEl.textContent = label;

  const track = document.createElement("div");
  track.className = "result-bar-track";

  const bar = document.createElement("div");
  bar.className = "result-bar";
  bar.style.width = `${percentage}%`;

  track.appendChild(bar);
  row.appendChild(labelEl);
  row.appendChild(track);

  return row;
}

function formatHour(isoHour) {
  return new Date(isoHour).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadResults() {
  const [resultsResponse, hourlyResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/results`),
    fetch(`${API_BASE_URL}/results?group_by=hour`)
  ]);

  const results = await resultsResponse.json();
  const hourly = await hourlyResponse.json();

  totalVotesEl.textContent = results.total_votes;

  resultsBarsEl.innerHTML = "";
  results.candidates.forEach((candidate) => {
    const label = `${candidate.name} — ${candidate.percentage}% (${candidate.votes})`;
    resultsBarsEl.appendChild(buildBarRow(label, candidate.percentage));
  });

  const maxTotal = Math.max(0, ...hourly.hours.map((entry) => entry.total));
  hourlyBarsEl.innerHTML = "";
  hourly.hours.forEach((entry) => {
    const percentage = maxTotal === 0 ? 0 : (entry.total / maxTotal) * 100;
    hourlyBarsEl.appendChild(buildBarRow(`${formatHour(entry.hour)} — ${entry.total}`, percentage));
  });
}

loadResults();
setInterval(loadResults, REFRESH_INTERVAL_MS);
