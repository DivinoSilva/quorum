require "rails_helper"

RSpec.describe Vote, type: :model do
  it "requires a candidate" do
    vote = Vote.new(candidate: nil)

    expect(vote).not_to be_valid
    expect(vote.errors[:candidate]).to be_present
  end

  describe ".hourly_totals" do
    it "groups votes by hour" do
      candidate = Candidate.create!(name: "A")
      Vote.create!(candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 15))
      Vote.create!(candidate: candidate, created_at: Time.utc(2026, 8, 13, 10, 45))
      Vote.create!(candidate: candidate, created_at: Time.utc(2026, 8, 13, 11, 5))

      totals = Vote.hourly_totals

      expect(totals).to eq(
        [
          { hour: "2026-08-13T10:00:00Z", total: 2 },
          { hour: "2026-08-13T11:00:00Z", total: 1 }
        ]
      )
    end
  end
end
