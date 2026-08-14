const API_BASE_URL = "";
const REFRESH_INTERVAL_MS = 3000;
const CANDIDATE_COLORS = ["#2563eb", "#06b6d4", "#f59e0b", "#22c55e", "#a855f7"];
const SVG_NS = "http://www.w3.org/2000/svg";

const STAT_ICONS = {
  users: '<circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path>',
  trendingUp: '<polyline points="3,17 9,11 13,15 21,7"></polyline><polyline points="14,7 21,7 21,14"></polyline>'
};

const totalVotesEl = document.getElementById("total-votes");
const statCardsEl = document.getElementById("stat-cards");
const candidateResultsEl = document.getElementById("candidate-results");
const hourlyChartEl = document.getElementById("hourly-chart");
const datePickerEl = document.getElementById("date-picker");
const peakHourLabelEl = document.getElementById("peak-hour-label");

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

datePickerEl.value = todayIsoDate();
datePickerEl.max = todayIsoDate();

function buildInitialsAvatar(candidate, color) {
  const div = document.createElement("div");
  div.className = "candidate-avatar";
  div.style.background = color;
  div.textContent = candidate.name.charAt(0).toUpperCase();
  return div;
}

function buildAvatar(candidate, color) {
  if (!candidate.photo_url) {
    return buildInitialsAvatar(candidate, color);
  }

  const img = document.createElement("img");
  img.className = "candidate-avatar";
  img.src = candidate.photo_url;
  img.alt = candidate.name;
  img.onerror = () => img.replaceWith(buildInitialsAvatar(candidate, color));

  return img;
}

function buildStatCard(icon, label, value) {
  const card = document.createElement("div");
  card.className = "stat-card";

  const labelEl = document.createElement("div");
  labelEl.className = "stat-label";
  labelEl.innerHTML = `<svg class="stat-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${STAT_ICONS[icon]}</svg><span>${label}</span>`;

  const valueEl = document.createElement("div");
  valueEl.className = "stat-value";
  valueEl.textContent = value;

  card.appendChild(labelEl);
  card.appendChild(valueEl);

  return card;
}

function formatHourLabel(isoHour) {
  return `${new Date(isoHour).getUTCHours().toString().padStart(2, "0")}h`;
}

function singleLeader(candidates) {
  const maxVotes = Math.max(...candidates.map((candidate) => candidate.votes));
  if (maxVotes === 0) return null;

  const leaders = candidates.filter((candidate) => candidate.votes === maxVotes);
  return leaders.length === 1 ? leaders[0] : null;
}

function leaderLabel(candidates) {
  const maxVotes = Math.max(...candidates.map((candidate) => candidate.votes));
  if (maxVotes === 0) return "—";

  const leader = singleLeader(candidates);
  return leader ? leader.name : "Empate";
}

function buildStatCards(results) {
  statCardsEl.innerHTML = "";
  statCardsEl.appendChild(buildStatCard("users", "Votos totais", results.total_votes));
  statCardsEl.appendChild(buildStatCard("trendingUp", "Liderança", leaderLabel(results.candidates)));
}

function updatePeakHourLabel(hourly) {
  const peakHour = hourly.hours.reduce((a, b) => (b.total > a.total ? b : a));
  peakHourLabelEl.textContent =
    peakHour.total > 0 ? `Pico às ${formatHourLabel(peakHour.hour)} — ${peakHour.total} votos` : "Nenhum voto neste dia";
}

function buildCandidateCard(candidate, color, isLeading) {
  const card = document.createElement("div");
  card.className = isLeading ? "candidate-result-card leading" : "candidate-result-card";

  const header = document.createElement("div");
  header.className = "candidate-header";

  const identity = document.createElement("div");
  identity.className = "candidate-identity";
  identity.appendChild(buildAvatar(candidate, color));

  const name = document.createElement("div");
  name.className = "candidate-name";
  name.textContent = candidate.name;
  identity.appendChild(name);

  const votes = document.createElement("div");
  votes.className = "candidate-votes";
  votes.textContent = `${candidate.votes} votos — ${candidate.percentage}%`;

  header.appendChild(identity);
  header.appendChild(votes);

  const track = document.createElement("div");
  track.className = "progress-track";
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  bar.style.width = `${candidate.percentage}%`;
  bar.style.background = color;
  track.appendChild(bar);

  card.appendChild(header);
  card.appendChild(track);

  return card;
}

function buildCandidateSeries(hours) {
  return hours[0].candidates.map((candidate, index) => ({
    id: candidate.id,
    name: candidate.name,
    color: CANDIDATE_COLORS[index % CANDIDATE_COLORS.length],
    values: hours.map((hour) => hour.candidates.find((c) => c.id === candidate.id).votes)
  }));
}

function niceAxis(rawMax) {
  const step = Math.max(1, Math.ceil(rawMax / 4));
  return { step, max: step * 4 };
}

function buildLineChart(hours, candidateSeries) {
  const width = 640;
  const height = 260;
  const padding = { top: 12, right: 16, bottom: 24, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const totalValues = hours.map((hour) => hour.total);
  const rawMax = Math.max(1, ...totalValues, ...candidateSeries.flatMap((series) => series.values));
  const { step, max: axisMax } = niceAxis(rawMax);
  const xStep = plotWidth / (hours.length - 1);

  const xFor = (i) => padding.left + i * xStep;
  const yFor = (value) => padding.top + plotHeight - (value / axisMax) * plotHeight;
  const toPoints = (values) => values.map((value, i) => `${xFor(i)},${yFor(value)}`).join(" ");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.classList.add("chart");

  for (let i = 0; i <= 4; i++) {
    const value = step * i;
    const y = yFor(value);

    const grid = document.createElementNS(SVG_NS, "line");
    grid.setAttribute("x1", padding.left);
    grid.setAttribute("y1", y);
    grid.setAttribute("x2", width - padding.right);
    grid.setAttribute("y2", y);
    grid.setAttribute("class", "chart-gridline");
    svg.appendChild(grid);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", padding.left - 6);
    label.setAttribute("y", y + 3);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "chart-label");
    label.textContent = value;
    svg.appendChild(label);
  }

  hours.forEach((hour, i) => {
    if (i % 3 !== 0) return;

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", xFor(i));
    label.setAttribute("y", height - 6);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "chart-label");
    label.textContent = formatHourLabel(hour.hour);
    svg.appendChild(label);
  });

  candidateSeries.forEach((series) => {
    const line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute("points", toPoints(series.values));
    line.setAttribute("class", "chart-line");
    line.setAttribute("stroke", series.color);
    svg.appendChild(line);
  });

  const totalLine = document.createElementNS(SVG_NS, "polyline");
  totalLine.setAttribute("points", toPoints(totalValues));
  totalLine.setAttribute("class", "chart-line chart-line-total");
  svg.appendChild(totalLine);

  const hoverLine = document.createElementNS(SVG_NS, "line");
  hoverLine.setAttribute("y1", padding.top);
  hoverLine.setAttribute("y2", padding.top + plotHeight);
  hoverLine.setAttribute("class", "chart-hover-line");
  svg.appendChild(hoverLine);

  const hoverDots = candidateSeries.map((series) => {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("r", 3.5);
    dot.setAttribute("class", "chart-dot");
    dot.setAttribute("fill", series.color);
    svg.appendChild(dot);
    return dot;
  });

  const totalDot = document.createElementNS(SVG_NS, "circle");
  totalDot.setAttribute("r", 3.5);
  totalDot.setAttribute("class", "chart-dot chart-dot-total");
  svg.appendChild(totalDot);

  const overlay = document.createElementNS(SVG_NS, "rect");
  overlay.setAttribute("x", padding.left);
  overlay.setAttribute("y", padding.top);
  overlay.setAttribute("width", plotWidth);
  overlay.setAttribute("height", plotHeight);
  overlay.setAttribute("class", "chart-overlay");
  svg.appendChild(overlay);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";

  function updateHover(clamped) {
    hoverLine.setAttribute("x1", xFor(clamped));
    hoverLine.setAttribute("x2", xFor(clamped));

    candidateSeries.forEach((series, i) => {
      hoverDots[i].setAttribute("cx", xFor(clamped));
      hoverDots[i].setAttribute("cy", yFor(series.values[clamped]));
    });
    totalDot.setAttribute("cx", xFor(clamped));
    totalDot.setAttribute("cy", yFor(totalValues[clamped]));

    const candidateLines = candidateSeries
      .map((series) => `<span style="color:${series.color}">${series.name}: ${series.values[clamped]}</span>`)
      .join("<br>");
    tooltip.innerHTML = `<strong>${formatHourLabel(hours[clamped].hour)}</strong><br>${candidateLines}<br>Total: ${totalValues[clamped]}`;
    tooltip.style.left = `${(xFor(clamped) / width) * 100}%`;
    tooltip.style.top = `${(yFor(totalValues[clamped]) / height) * 100}%`;
  }

  overlay.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round((relativeX - padding.left) / xStep);
    const clamped = Math.max(0, Math.min(hours.length - 1, index));

    updateHover(clamped);
    hoverLine.style.display = "block";
    hoverDots.forEach((dot) => (dot.style.display = "block"));
    totalDot.style.display = "block";
    tooltip.style.display = "block";
  });

  overlay.addEventListener("mouseleave", () => {
    hoverLine.style.display = "none";
    hoverDots.forEach((dot) => (dot.style.display = "none"));
    totalDot.style.display = "none";
    tooltip.style.display = "none";
  });

  const wrapper = document.createElement("div");
  wrapper.className = "chart-wrapper";
  wrapper.appendChild(svg);
  wrapper.appendChild(tooltip);

  return wrapper;
}

function buildLegend(candidateSeries) {
  const legend = document.createElement("div");
  legend.className = "chart-legend";

  candidateSeries.forEach((series) => {
    const item = document.createElement("div");
    item.className = "chart-legend-item";

    const swatch = document.createElement("span");
    swatch.className = "chart-legend-swatch";
    swatch.style.background = series.color;

    const label = document.createElement("span");
    label.textContent = series.name;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });

  const totalItem = document.createElement("div");
  totalItem.className = "chart-legend-item";

  const totalSwatch = document.createElement("span");
  totalSwatch.className = "chart-legend-swatch chart-legend-swatch-total";

  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total";

  totalItem.appendChild(totalSwatch);
  totalItem.appendChild(totalLabel);
  legend.appendChild(totalItem);

  return legend;
}

async function loadResults() {
  const [resultsResponse, hourlyResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/results`),
    fetch(`${API_BASE_URL}/results?group_by=hour&date=${datePickerEl.value}`)
  ]);

  const results = await resultsResponse.json();
  const hourly = await hourlyResponse.json();

  totalVotesEl.textContent = results.total_votes;
  buildStatCards(results);
  updatePeakHourLabel(hourly);

  const leader = singleLeader(results.candidates);

  candidateResultsEl.innerHTML = "";
  results.candidates.forEach((candidate, index) => {
    const color = CANDIDATE_COLORS[index % CANDIDATE_COLORS.length];
    candidateResultsEl.appendChild(buildCandidateCard(candidate, color, leader?.id === candidate.id));
  });

  const candidateSeries = buildCandidateSeries(hourly.hours);

  hourlyChartEl.innerHTML = "";
  hourlyChartEl.appendChild(buildLineChart(hourly.hours, candidateSeries));
  hourlyChartEl.appendChild(buildLegend(candidateSeries));
}

datePickerEl.addEventListener("change", loadResults);

loadResults();
setInterval(loadResults, REFRESH_INTERVAL_MS);
