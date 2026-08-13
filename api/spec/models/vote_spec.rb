require 'rails_helper'

RSpec.describe Vote, type: :model do
  it 'requires a candidate' do
    vote = build(:vote, candidate: nil)

    expect(vote).not_to be_valid
    expect(vote.errors[:candidate]).to be_present
  end

  describe '.hourly_totals' do
    let(:candidate) { create(:candidate) }

    it 'returns all 24 hours of the current day, zero-filled where there are no votes' do
      travel_to Time.utc(2026, 8, 13, 15, 0)

      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 15))
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 45))
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 11, 5))

      totals = described_class.hourly_totals

      expect(totals.size).to eq(24)
      expect(totals[10]).to eq({ hour: '2026-08-13T10:00:00Z', total: 2 })
      expect(totals[11]).to eq({ hour: '2026-08-13T11:00:00Z', total: 1 })
      expect(totals[0]).to eq({ hour: '2026-08-13T00:00:00Z', total: 0 })
      expect(totals[23]).to eq({ hour: '2026-08-13T23:00:00Z', total: 0 })
    end

    it 'excludes votes from other days' do
      travel_to Time.utc(2026, 8, 13, 15, 0)

      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 12, 10, 0))
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 14, 10, 0))

      totals = described_class.hourly_totals

      expect(totals.sum { |entry| entry[:total] }).to eq(0)
    end

    it 'accepts an explicit date, independent of the current day' do
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 10, 9, 0))

      totals = described_class.hourly_totals(Date.new(2026, 8, 10))

      expect(totals[9]).to eq({ hour: '2026-08-10T09:00:00Z', total: 1 })
    end
  end
end
