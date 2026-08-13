require "rails_helper"

RSpec.describe "GET /results", type: :request do
  let!(:a) { create(:candidate) }
  let!(:b) { create(:candidate) }

  it "returns totals and per-candidate breakdown" do
    create(:vote, candidate: a)
    create(:vote, candidate: b)

    get "/results"

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["total_votes"]).to eq(2)
    expect(body["candidates"].map { |c| c["id"] }).to contain_exactly(a.id, b.id)
  end
end

RSpec.describe "GET /results/hourly", type: :request do
  let!(:candidate) { create(:candidate) }

  it "returns votes grouped by hour" do
    create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 0))

    get "/results/hourly"

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["hours"]).to eq([{ "hour" => "2026-08-13T10:00:00Z", "total" => 1 }])
  end
end
