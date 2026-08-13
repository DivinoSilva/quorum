Rack::Attack.cache.store = Rails.cache

Rack::Attack.throttle('votes/ip', limit: 20, period: 10.seconds) do |req|
  req.ip if req.path == '/votes' && req.post?
end
