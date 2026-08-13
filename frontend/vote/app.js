const API_BASE_URL = "";

const votingScreen = document.getElementById("voting-screen");
const confirmationScreen = document.getElementById("confirmation-screen");
const candidateButtons = [
  document.getElementById("candidate-btn-0"),
  document.getElementById("candidate-btn-1")
];
const votingError = document.getElementById("voting-error");
const votedForEl = document.getElementById("voted-for");
const resultsBarsEl = document.getElementById("results-bars");
const voteAgainBtn = document.getElementById("vote-again-btn");

let candidates = [];

function showError(message) {
  votingError.textContent = message;
  votingError.classList.remove("hidden");
}

function clearError() {
  votingError.classList.add("hidden");
}

async function loadCandidates() {
  const response = await fetch(`${API_BASE_URL}/candidates`);
  if (!response.ok) {
    throw new Error("Could not load candidates");
  }

  const data = await response.json();
  candidates = data.candidates;

  candidates.forEach((candidate, index) => {
    const button = candidateButtons[index];
    button.textContent = candidate.name;
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
      throw new Error("Too many votes from this device. Try again in a moment.");
    }

    if (!response.ok) {
      throw new Error("Could not record your vote. Try again.");
    }

    const data = await response.json();
    showConfirmation(data);
  } catch (error) {
    showError(error.message);
    candidateButtons.forEach((button) => (button.disabled = false));
  }
}

function buildResultRow(candidate) {
  const row = document.createElement("div");
  row.className = "result-row";

  const label = document.createElement("div");
  label.className = "result-label";
  label.textContent = `${candidate.name} — ${candidate.percentage}% (${candidate.votes})`;

  const track = document.createElement("div");
  track.className = "result-bar-track";

  const bar = document.createElement("div");
  bar.className = "result-bar";
  bar.style.width = `${candidate.percentage}%`;

  track.appendChild(bar);
  row.appendChild(label);
  row.appendChild(track);

  return row;
}

function showConfirmation(data) {
  const votedCandidate = candidates.find((candidate) => candidate.id === data.vote.candidate_id);
  votedForEl.textContent = votedCandidate ? votedCandidate.name : "";

  resultsBarsEl.innerHTML = "";
  data.results.candidates.forEach((candidate) => {
    resultsBarsEl.appendChild(buildResultRow(candidate));
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

loadCandidates().catch(() => showError("Could not load candidates. Refresh the page."));
