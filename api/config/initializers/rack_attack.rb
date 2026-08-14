Rack::Attack.cache.store = Rails.cache

Rack::Attack.throttle('votes/ip', limit: 20, period: 10.seconds) do |req|
  req.ip if req.path == '/votes' && req.post?
end

ActiveSupport::Notifications.subscribe('throttle.rack_attack') do |_name, _start, _finish, _id, payload|
  Rails.logger.warn("throttled request ip=#{payload[:request].ip} path=#{payload[:request].path}")
end
