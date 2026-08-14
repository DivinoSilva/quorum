require 'prometheus/client/data_stores/direct_file_store'

# Puma runs WEB_CONCURRENCY worker processes (see config/puma.rb); the default
# Synchronized store keeps metrics in per-process memory, so a scrape only ever sees
# whichever worker happened to answer it. DirectFileStore has each process write to its
# own file and sums them on read, giving Prometheus the real total across all workers.
#
# This runs once, in the master process, before Puma forks (preload_app! in puma.rb) —
# metrics must be declared and the directory cleared before the fork, per the gem's
# multi-process caveats, otherwise a restarted worker can reuse a low PID and silently
# merge with a stale file left by a previous run.
metrics_dir = Rails.root.join('tmp/prometheus_multiproc').to_s

# This initializer also runs for `rails runner`/`console`/rake, which share this
# directory with the live Puma server. Only the actual server boot may wipe it —
# otherwise a console opened alongside a running server would silently zero out
# its in-flight metrics. ARGV isn't a reliable signal here (Rails' command
# dispatch consumes it before initializers run for both `server` and `runner`),
# but the `Rails::Server` class is only ever loaded along the server boot path.
FileUtils.rm_rf(metrics_dir) if Rails.const_defined?(:Server)
FileUtils.mkdir_p(metrics_dir)

Prometheus::Client.config.data_store = Prometheus::Client::DataStores::DirectFileStore.new(dir: metrics_dir)

VOTES_COUNTER = Prometheus::Client::Counter.new(
  :votes_total,
  docstring: 'Total votes cast',
  labels: %i[candidate_id candidate_name]
)

Prometheus::Client.registry.register(VOTES_COUNTER)
