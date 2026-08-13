require "rails_helper"

RSpec.describe "POST /votes", type: :request do
  let!(:candidate) { create(:candidate) }

  it "creates a vote and returns current results" do
    post "/votes", params: { candidate_id: candidate.id }, as: :json

    expect(response).to have_http_status(:created)

    body = JSON.parse(response.body)
    expect(body["vote"]["candidate_id"]).to eq(candidate.id)
    expect(body["results"]["total_votes"]).to eq(1)
  end

  it "records the masked request ip" do
    post "/votes", params: { candidate_id: candidate.id }, as: :json, env: { "REMOTE_ADDR" => "203.0.113.42" }

    expect(Vote.last.voter_ip_masked).to eq("203.0.113.0")
  end

  it "returns 404 for an unknown candidate" do
    post "/votes", params: { candidate_id: 0 }, as: :json

    expect(response).to have_http_status(:not_found)
  end

  it "allows voting more than once" do
    post "/votes", params: { candidate_id: candidate.id }, as: :json
    post "/votes", params: { candidate_id: candidate.id }, as: :json

    expect(Vote.where(candidate: candidate).count).to eq(2)
  end
end
