require 'rails_helper'

RSpec.describe 'GET /results', type: :request do
  let!(:a) { create(:candidate) }
  let!(:b) { create(:candidate) }

  it 'returns totals and per-candidate breakdown' do
    create(:vote, candidate: a)
    create(:vote, candidate: b)

    get '/results'

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['total_votes']).to eq(2)
    expect(body['candidates'].pluck('id')).to contain_exactly(a.id, b.id)
  end
end

RSpec.describe 'GET /results/hourly', type: :request do
  let!(:candidate) { create(:candidate) }

  it 'returns all 24 hours of the current day, zero-filled where there are no votes' do
    travel_to Time.utc(2026, 8, 13, 15, 0)
    create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 0))

    get '/results/hourly'

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['hours'].size).to eq(24)
    expect(body['hours'][10]).to eq({ 'hour' => '2026-08-13T10:00:00Z', 'total' => 1 })
    expect(body['hours'][0]).to eq({ 'hour' => '2026-08-13T00:00:00Z', 'total' => 0 })
    expect(body['date']).to eq('2026-08-13')
  end

  it 'accepts a date query param for a different day' do
    create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 10, 9, 0))

    get '/results/hourly', params: { date: '2026-08-10' }

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['date']).to eq('2026-08-10')
    expect(body['hours'][9]).to eq({ 'hour' => '2026-08-10T09:00:00Z', 'total' => 1 })
  end

  it 'returns 400 for a malformed date' do
    get '/results/hourly', params: { date: 'not-a-date' }

    expect(response).to have_http_status(:bad_request)
  end
end
