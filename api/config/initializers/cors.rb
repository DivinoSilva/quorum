# Allows the React frontend (served from a different origin/container) to call this API.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")

    resource "*",
      headers: :any,
      methods: [:get, :post, :options]
  end
end
