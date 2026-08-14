# Quorum

[![CI](https://github.com/DivinoSilva/quorum/actions/workflows/ci.yml/badge.svg)](https://github.com/DivinoSilva/quorum/actions/workflows/ci.yml)

A generic, high-throughput vote-tallying system. Built for the Laager FullStack technical
challenge: two options face off, people vote, results are shown as running percentages.
Nothing in the domain model is tied to any specific show or event — it works for any
two-option vote.

## The problem, in one paragraph

Users vote for one of two options as many times as they want — but votes must come from
people, not scripts. Peak traffic is ~1,000 votes/second. After voting, the user sees a
confirmation and the current percentage split. Production also needs total votes, votes
per candidate, and votes per hour, queryable at any time.

## Architecture

```mermaid
flowchart TD
    Browser(["Browser"]) -->|"http://localhost:3000/..."| Proxy["proxy — nginx reverse proxy<br/>only container exposed to the host"]

    Proxy -->|"/candidates, /votes, /results,<br/>/metrics, /up, /api-docs"| API["api — Ruby on Rails (API-only)"]
    Proxy -->|"everything else<br/>(/, /vote/*, static assets)"| Frontend["frontend — HTML/CSS/JS<br/>no build step, nginx<br/>(static files only, no backend of its own)"]

    API -->|"INSERT vote<br/>(sync, WAL fsync)"| Postgres[("postgres<br/>source of truth for votes")]
    API -->|"throttle check / cache read"| Redis[("redis<br/>cache for /results +<br/>shared Rack::Attack store")]

    Prometheus["prometheus"] -->|"scrape /metrics"| API
    Grafana["grafana"] -->|"datasource"| Prometheus
```

`api` and `frontend` remain separate, independently deployable containers — the challenge's
"API and frontend as different microservices" requirement. `proxy` only does path-based
routing (no business logic) so the whole app answers on a single public port without
merging the two services into one process. Postgres, Redis, Prometheus and Grafana are
each their own container too.

## Key decisions and trade-offs

These are the calls most likely to come up in a live Q&A, so they're documented
up front rather than left implicit in the code.

- **PostgreSQL is the only source of truth for votes.** Every vote is a single `INSERT`.
  Postgres's default `synchronous_commit = on` means a vote is only acknowledged to the
  client after it's durably written to the WAL — it survives a crash or restart. We never
  disable this for speed: doing so would reintroduce exactly the data-loss risk a voting
  system can't accept.
- **Throughput without sacrificing that durability comes from Postgres's group commit**:
  concurrent transactions arriving close together share a single fsync, so the database
  sustains high write concurrency without a queue or async worker in front of it.
- **Redis is a read-side accelerator, not a data store for votes.** It does two things:
  caches the aggregate `/results` response for a couple of seconds (so read traffic from
  people checking results doesn't compete with the write path during peak voting), and
  backs Rack::Attack's throttle counters so abuse limits are shared across every API
  process/replica instead of being tracked in isolation per-process. If Redis is
  unavailable, the app degrades to querying Postgres directly — slower, never lossy.
- **Bot/abuse mitigation is Rack::Attack throttling**, not a vote-count limit — the
  business rule explicitly allows unlimited votes per person, so the goal is filtering
  machine-driven traffic patterns, not restricting legitimate repeat voting.
- **No Kafka, RabbitMQ, Sidekiq, Kubernetes, or CQRS/Event Sourcing in this version.**
  Each would add real value at a larger scale, but also add a moving part that has to be
  operated and explained without improving on what a single well-indexed Postgres table
  and in-process Prometheus instrumentation already deliver for this problem size. They're
  called out here as the deliberate next step, not an oversight.

## Stack

| Layer | Choice |
|---|---|
| API | Ruby on Rails 7 (API-only) |
| Frontend | HTML/CSS/JavaScript (no framework, no build step) |
| Database | PostgreSQL |
| Cache / throttle store | Redis |
| Metrics | prometheus-client (Rails) + Prometheus |
| Dashboards | Grafana |
| Load testing | k6 |
| Containers | Docker, orchestrated with Docker Compose |

## Repository layout

```
api/            Rails API (votes, results, /metrics)
frontend/       Plain HTML/CSS/JS — index.html (hub) + vote/ + dashboard/
proxy/          nginx reverse proxy unifying api + frontend on one port
monitoring/     Prometheus scrape config + Grafana provisioning/dashboards
load-test/      k6 script exercising the ~1,000 votes/sec target
docker-compose.yml
```

## Running locally

Requires Docker and Docker Compose.

```bash
git clone https://github.com/DivinoSilva/quorum.git
cd quorum
docker compose up --build
```

Everything is served from one port:

- http://localhost:3000/ — hub page (links to voting, results, docs, dashboards)
- http://localhost:3000/vote/ — voting screen
- http://localhost:3000/dashboard/ — human-readable results dashboard, auto-refreshing (this is the "URL" the PDF asks production to check totals at)
- http://localhost:3000/results, /metrics, /up, /api-docs — raw API, for tooling/integration
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (login `admin` / `admin`)

For active development it's usually faster to run the API directly on the host (while
Postgres/Redis stay in Docker):

```bash
docker compose up postgres redis
cd api && bin/rails db:setup && bin/rails s
```

The frontend fetches with relative paths (`/candidates`, `/votes`, ...), so it expects to
be served from the same origin as the API — through `docker compose up`, or any static
server proxied the same way. Opening `frontend/index.html` directly as a `file://` URL
won't work.

## API documentation

| Method | Path | Description |
|---|---|---|
| GET | `/candidates` | The two voting options: `{ candidates: [{ id, name, photo_url }] }` |
| POST | `/votes` | Body: `{ candidate_id }`. Returns `201` with `{ vote: { id, candidate_id }, results }`, or `404` if the candidate doesn't exist |
| GET | `/results` | `{ total_votes, candidates: [{ id, name, votes, percentage }] }` |
| GET | `/results?group_by=hour&date=YYYY-MM-DD` | Same resource, filtered: `{ date, hours: [{ hour, total }] }` — all 24 hours of that day, zero-filled. `date` defaults to today; `400` on an unsupported `group_by` or malformed `date` |
| GET | `/metrics` | Prometheus exposition format: `votes_total`, `http_server_requests_total`, `http_server_request_duration_seconds` |
| GET | `/up` | Health check, always `200 OK` |

`POST /votes` is throttled by Rack::Attack (20 requests per IP per 10 seconds) — voting itself has no limit, this only targets script-like request patterns.

The full OpenAPI contract is browsable at http://localhost:3000/api-docs (Swagger UI), served from `api/swagger/v1/swagger.yaml`.

## Logging

Structured, leveled logs across the request lifecycle:

| Level | When |
|---|---|
| `info` | A vote is recorded (`vote created id=... candidate_id=...`) |
| `warn` | A vote is rejected for an unknown candidate, or Rack::Attack throttles a request |
| `error` | Redis is unreachable (`config.cache_store`'s `error_handler`, `/results` still serves from Postgres), or any other unhandled exception (`ApplicationController`'s `rescue_from`, which also returns a clean `500` instead of leaking a stack trace) |
| `debug` | Every `/results` request logs the query params it received |

To see the `error` path live: `docker compose stop postgres`, hit `POST /votes` (returns `500` with `{"error":"internal server error"}`, logs `unhandled exception: ...`), then `docker compose start postgres`. Same idea with `docker compose stop redis` against `GET /results` — it keeps returning `200` from Postgres directly while logging the Redis error.

## Monitoring

Prometheus scrapes `/metrics` every 5s (`monitoring/prometheus.yml`). Grafana auto-provisions
the Prometheus datasource and three dashboards (`monitoring/grafana/provisioning/dashboards/json/`)
on startup — nothing to click through by hand. Open http://localhost:3001 (`admin`/`admin`) →
folder **Quorum**:

- **Quorum — Votes & Business**: total votes, votes/sec, progress toward the 1,000
  votes/sec peak target, votes by candidate (distribution) and votes/sec by candidate (trend).
- **Quorum — API Performance**: requests/sec by route, p50/p95/p99 latency by route, total
  throughput, average response time.
- **Quorum — Errors & Debug**: error rate (5xx), throttled votes (429/sec), unhandled
  exceptions escaping to Rack, requests by status code, 4xx/5xx broken down by route — the
  dashboard to open first when something looks wrong.

### Two multi-process gotchas found and fixed while building this

Both were invisible until traffic was pushed through the actual Puma configuration
(`WEB_CONCURRENCY=12`, `config/puma.rb`), not obvious from reading the code in isolation:

- **Throttled (429) requests were invisible to Prometheus.** `config/application.rb` had
  `Rack::Attack` registered *before* `Prometheus::Middleware::Collector`, so a throttled
  request never reached the Collector at all — Rack::Attack's own short-circuit response
  skipped it. Fixed by reordering so Collector wraps Rack::Attack: it now sees every
  response Rack::Attack returns, including the 429s.
- **Metrics were inconsistent between scrapes.** prometheus-client's default `Synchronized`
  store keeps counters in per-process memory. With 12 Puma workers, each scrape landed on
  one arbitrary worker and only reported that worker's local counters — the same query could
  return 0 or the full total depending on which process answered. Fixed in
  `config/initializers/prometheus.rb` by switching to `DirectFileStore`, the gem's
  documented multi-process store: each worker writes to its own file, and a scrape sums
  across all of them. The metrics directory is wiped before Puma forks (`preload_app!` in
  `config/puma.rb` runs the initializer once in the master process), since a restarted
  worker can reuse a low PID and would otherwise silently merge with a stale file from a
  previous run.

## Code style

```bash
docker compose exec api bundle exec rubocop
```

## Running tests

```bash
docker compose exec -e RAILS_ENV=test -e DATABASE_URL=postgres://quorum:quorum@postgres:5432/quorum_test api bin/rails db:test:prepare
docker compose exec -e RAILS_ENV=test -e DATABASE_URL=postgres://quorum:quorum@postgres:5432/quorum_test api bundle exec rspec
```

## SLO / SLI

Two objectives, chosen because they're exactly what production would notice during peak
voting — and both are already on the dashboard, not just written down.

| SLO | Target | SLI (PromQL) | Dashboard panel |
|---|---|---|---|
| Availability | ≥ 99.5% of requests succeed (non-5xx) over a rolling 5m window | `1 - (sum(rate(http_server_requests_total{code=~"5.."}[5m])) or vector(0)) / (sum(rate(http_server_requests_total[5m])) or vector(1))` | Errors & Debug → "Taxa de erro (5xx, janela 5m)" |
| Latency | p95 of any route stays under 300ms | `histogram_quantile(0.95, sum by (le, path) (rate(http_server_request_duration_seconds_bucket[5m])))` | API Performance → "Latência por rota — p50 / p95 / p99" |

If the error-rate SLI drops below 99.5% or the latency SLI crosses 300ms sustained, that's
the signal to look at Redis/Postgres health first — per the trade-offs above, those are the
two dependencies whose failure mode is "slower" rather than "down."

## Load testing

```bash
docker run --rm --network laager_default \
  -e BASE_URL=http://proxy:3000 \
  -e CANDIDATE_IDS=1,2 \
  -v "$(pwd)/load-test:/scripts" \
  grafana/k6 run /scripts/vote-load-test.js
```

`k6`'s `constant-arrival-rate` executor drives the ~1,000 votes/sec target from the PDF for
30s. Two things need to be disabled first, both env-gated so they're never accidentally left
off in a real deploy:

- **Rack::Attack's per-IP throttle** — a load generator hitting from one machine looks
  exactly like the bot traffic it's designed to catch. Real 1,000 votes/sec comes from
  thousands of distinct viewer IPs, not one, so throttling isn't what this test measures.
- **Rails' development-mode class reloading** — reloads on every request by default, which
  is irrelevant to whether the app can sustain load.

```bash
# docker-compose.override.yml (gitignored — this is a local, temporary toggle, not a
# permanent deploy setting)
services:
  api:
    environment:
      DISABLE_VOTE_THROTTLE: "true"
      LOAD_TEST: "true"
```

`docker compose up -d api` to apply it, then remove the file and `docker compose up -d api`
again afterward to restore normal throttling.

**What running this actually found**: the first three attempts failed outright, and each
failure was a real, permanent fix, not a load-test-only workaround:

1. **100% failure, every request blocked** — the proxy forwards requests with `Host: proxy`,
   which Rails' `HostAuthorization` middleware didn't have on its allowlist (only `api` had
   been added, for Prometheus's direct scrape). Fixed in `config/application.rb`, which also
   caught that the allowlist had only ever been added to the `development` environment, not
   the shared config — a gap that would have reproduced in production too.
2. **0% failure but ~80 req/s and mounting latency** — Puma was running its Rails default:
   one process, 5 threads. Under MRI's GIL, threads only help with I/O wait, not real
   parallelism; `laager-api-1` pinned at ~100% CPU (one core) while Postgres sat at 0%,
   which is what confirmed the bottleneck was Ruby concurrency, not the database.
3. **Multi-process would fix that, but `prometheus-client`'s default in-memory store isn't
   shared across forked workers** — enabling Puma's `workers` naively would have made
   `votes_total` only reflect whichever worker happened to answer a given `/metrics` scrape.
   Fixed by switching to `prometheus-client`'s `DirectFileStore` (`config/application.rb`),
   which aggregates every worker's counters from disk on scrape — verified by casting votes
   and confirming `/metrics` summed them across workers before turning load testing loose on
   it. (Also found and fixed: `DirectFileStore` doesn't clean up stale files from previous
   process IDs on its own, so a boot-time `FileUtils.rm_rf` was added — otherwise metrics
   from long-dead workers slowly pollute every future scrape.)

With those three fixed (`config/puma.rb`: `WEB_CONCURRENCY=12` workers, 5 threads each) and
run on a shared 16-core dev machine — also running Postgres, Redis, the proxy, Prometheus,
Grafana, and the `k6` load generator itself, not dedicated hardware — the app sustains
**~900-920 req/s at 99%+ success**, at which point the host's own CPU is fully saturated
(`laager-api-1` ~8 cores, `postgres` ~5 cores, load average ≈ core count). That ceiling is
this machine, not the architecture: production would run on dedicated infrastructure, and
scale the rest of the way by adding more `api` container replicas behind the proxy — the
same horizontal pattern already used for every other service in this stack.
