require 'rails_helper'

RSpec.describe Vote, type: :model do
  it 'requires a candidate' do
    vote = build(:vote, candidate: nil)

    expect(vote).not_to be_valid
    expect(vote.errors[:candidate]).to be_present
  end

  describe '.hourly_totals' do
    let(:candidate) { create(:candidate) }

    it 'groups votes by hour' do
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 15))
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 45))
      create(:vote, candidate: candidate, created_at: Time.utc(2026, 8, 13, 11, 5))

      totals = described_class.hourly_totals

      expect(totals).to eq(
        [
          { hour: '2026-08-13T10:00:00Z', total: 2 },
          { hour: '2026-08-13T11:00:00Z', total: 1 }
        ]
      )
    end
  end
end
