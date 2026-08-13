# Shares the Redis-backed Rails cache so throttle counts are consistent across
# every API process/replica, not just the one that received the request.
Rack::Attack.cache.store = Rails.cache

# Baseline bot/abuse guard: a real person clicking a vote button won't hit this;
# a script hammering the endpoint will. Tuned further once we see real traffic shape.
Rack::Attack.throttle("votes/ip", limit: 20, period: 10.seconds) do |req|
  req.ip if req.path == "/votes" && req.post?
end
