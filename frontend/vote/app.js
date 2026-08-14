const API_BASE_URL = "";
const CANDIDATE_COLORS = ["#2563eb", "#06b6d4", "#f59e0b", "#22c55e", "#a855f7"];

const votingScreen = document.getElementById("voting-screen");
const confirmationScreen = document.getElementById("confirmation-screen");
const candidateButtons = [
  document.getElementById("candidate-btn-0"),
  document.getElementById("candidate-btn-1")
];
const votingError = document.getElementById("voting-error");
const votedForEl = document.getElementById("voted-for");
const partialTotalVotesEl = document.getElementById("partial-total-votes");
const resultsRowsEl = document.getElementById("results-rows");
const voteAgainBtn = document.getElementById("vote-again-btn");

let candidates = [];

function showError(message) {
  votingError.textContent = message;
  votingError.classList.remove("hidden");
}

function clearError() {
  votingError.classList.add("hidden");
}

function buildInitialsAvatar(candidate, color) {
  const span = document.createElement("span");
  span.className = "vote-candidate-avatar";
  span.style.background = color;
  span.textContent = candidate.name.charAt(0).toUpperCase();
  return span;
}

function buildAvatar(candidate, color) {
  if (!candidate.photo_url) {
    return buildInitialsAvatar(candidate, color);
  }

  const img = document.createElement("img");
  img.className = "vote-candidate-avatar";
  img.src = candidate.photo_url;
  img.alt = candidate.name;
  img.onerror = () => img.replaceWith(buildInitialsAvatar(candidate, color));

  return img;
}

async function loadCandidates() {
  const response = await fetch(`${API_BASE_URL}/candidates`);
  if (!response.ok) {
    throw new Error("Could not load candidates");
  }

  const data = await response.json();
  candidates = data.candidates;

  candidates.forEach((candidate, index) => {
    const color = CANDIDATE_COLORS[index % CANDIDATE_COLORS.length];
    const button = candidateButtons[index];

    button.innerHTML = "";
    button.appendChild(buildAvatar(candidate, color));
    button.appendChild(document.createTextNode(candidate.name));
    button.dataset.candidateId = candidate.id;
    button.disabled = false;
    button.addEventListener("click", () => castVote(candidate.id));
  });
}

async function castVote(candidateId) {
  candidateButtons.forEach((button) => (button.disabled = true));
  clearError();

  try {
    const response = await fetch(`${API_BASE_URL}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId })
    });

    if (response.status === 429) {
      throw new Error("Muitos votos deste dispositivo em pouco tempo. Tente novamente em instantes.");
    }

    if (!response.ok) {
      throw new Error("Não foi possível registrar seu voto. Tente novamente.");
    }

    const data = await response.json();
    showConfirmation(data);
  } catch (error) {
    showError(error.message);
    candidateButtons.forEach((button) => (button.disabled = false));
  }
}

function buildResultRow(candidate, color) {
  const row = document.createElement("div");
  row.className = "result-row";

  const header = document.createElement("div");
  header.className = "result-row-header";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = candidate.name;

  const stat = document.createElement("span");
  stat.className = "stat";
  stat.textContent = `${candidate.percentage}% (${candidate.votes})`;

  header.appendChild(name);
  header.appendChild(stat);

  const track = document.createElement("div");
  track.className = "progress-track";

  const bar = document.createElement("div");
  bar.className = "progress-bar";
  bar.style.width = `${candidate.percentage}%`;
  bar.style.background = color;
  track.appendChild(bar);

  row.appendChild(header);
  row.appendChild(track);

  return row;
}

function showConfirmation(data) {
  const votedCandidate = candidates.find((candidate) => candidate.id === data.vote.candidate_id);
  votedForEl.textContent = votedCandidate ? votedCandidate.name : "";
  partialTotalVotesEl.textContent = data.results.total_votes;

  resultsRowsEl.innerHTML = "";
  data.results.candidates.forEach((candidate, index) => {
    const color = CANDIDATE_COLORS[index % CANDIDATE_COLORS.length];
    resultsRowsEl.appendChild(buildResultRow(candidate, color));
  });

  votingScreen.classList.add("hidden");
  confirmationScreen.classList.remove("hidden");
}

function resetToVoting() {
  confirmationScreen.classList.add("hidden");
  votingScreen.classList.remove("hidden");
  candidateButtons.forEach((button) => (button.disabled = false));
}

voteAgainBtn.addEventListener("click", resetToVoting);

loadCandidates().catch(() => showError("Não foi possível carregar os candidatos. Atualize a página."));
