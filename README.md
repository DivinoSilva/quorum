# Quorum

A generic, high-throughput vote-tallying system. Built for the Laager FullStack technical
challenge: two options face off, people vote, results are shown as running percentages.
Nothing in the domain model is tied to any specific show or event — it works for any
two-option vote.

> Status: project scaffold. Domain logic (voting endpoints, results, frontend screens) is
> being implemented next. This README will grow alongside it.

## The problem, in one paragraph

Users vote for one of two options as many times as they want — but votes must come from
people, not scripts. Peak traffic is ~1,000 votes/second. After voting, the user sees a
confirmation and the current percentage split. Production also needs total votes, votes
per candidate, and votes per hour, queryable at any time.

## Architecture

```
[Browser]
    │ HTTP (fetch)
    ▼
[frontend]  — HTML/CSS/JS (no build step), served by nginx
    │ HTTP (fetch, CORS)
    ▼
[api]  — Ruby on Rails (API-only)
    │                                  │
    │ INSERT vote (sync, WAL fsync)    │ throttle check / cache read
    ▼                                  ▼
[postgres]                         [redis]
 source of truth for votes          read-side cache for /results
                                     + shared Rack::Attack store

[prometheus] ──scrape /metrics──▶ [api]
[grafana] ──datasource──▶ [prometheus]
```

Two containers cover the challenge's "API and frontend as different microservices"
requirement; Postgres, Redis, Prometheus and Grafana are each their own container too,
so every component can be reasoned about, scaled, and explained independently.

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
frontend/       Plain HTML/CSS/JS (voting screen, results screen)
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

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (login `admin` / `admin`)

For active development, it's usually faster to run the API directly on the host (while
Postgres/Redis stay in Docker) and open `frontend/index.html` straight in a browser —
there's no build step:

```bash
docker compose up postgres redis
cd api && bin/rails db:setup && bin/rails s
```

## API documentation

| Method | Path | Description |
|---|---|---|
| GET | `/candidates` | The two voting options: `{ candidates: [{ id, name, photo_url }] }` |
| POST | `/votes` | Body: `{ candidate_id }`. Returns `201` with `{ vote: { id, candidate_id }, results }`, or `404` if the candidate doesn't exist |
| GET | `/results` | `{ total_votes, candidates: [{ id, name, votes, percentage }] }` |
| GET | `/results/hourly` | `{ hours: [{ hour, total }] }`, one entry per hour with at least one vote |
| GET | `/metrics` | Prometheus exposition format: `votes_total`, `http_server_requests_total`, `http_server_request_duration_seconds` |
| GET | `/up` | Health check, always `200 OK` |

`POST /votes` is throttled by Rack::Attack (20 requests per IP per 10 seconds) — voting itself has no limit, this only targets script-like request patterns.

The full OpenAPI contract is browsable at http://localhost:3000/api-docs (Swagger UI), served from `api/swagger/v1/swagger.yaml`.

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

_Coming next, alongside load testing._
