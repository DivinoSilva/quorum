fetch("/results")
  .then((response) => response.json())
  .then((results) => {
    document.getElementById("home-total-votes").textContent = results.total_votes;
  })
  .catch(() => {});
