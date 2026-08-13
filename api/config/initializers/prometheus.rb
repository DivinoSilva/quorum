VOTES_COUNTER = Prometheus::Client::Counter.new(
  :votes_total,
  docstring: "Total votes cast",
  labels: [:candidate_id]
)

Prometheus::Client.registry.register(VOTES_COUNTER)
