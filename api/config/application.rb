require_relative 'boot'

require 'rails'
# Pick the frameworks you want:
require 'active_model/railtie'
require 'active_job/railtie'
require 'active_record/railtie'
# require "active_storage/engine"
require 'action_controller/railtie'
# require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require 'action_view/railtie'
# require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

require 'prometheus/middleware/collector'
require 'prometheus/middleware/exporter'
require 'prometheus/client/data_stores/direct_file_store'
require 'fileutils'

prometheus_multiproc_dir = ENV.fetch('PROMETHEUS_MULTIPROC_DIR', '/tmp/prometheus_multiproc')
FileUtils.rm_rf(prometheus_multiproc_dir)
Prometheus::Client.config.data_store =
  Prometheus::Client::DataStores::DirectFileStore.new(dir: prometheus_multiproc_dir)

module Api
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.0

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true
    config.hosts << 'api'
    config.hosts << 'proxy'

    config.cache_store = :redis_cache_store, {
      url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0'),
      error_handler: lambda { |method:, exception:, **_|
        Rails.logger.error("redis cache error method=#{method} exception=#{exception.class}: #{exception.message}")
      }
    }

    config.middleware.use Rack::Attack
    config.middleware.use Prometheus::Middleware::Collector
    config.middleware.use Prometheus::Middleware::Exporter
  end
end
