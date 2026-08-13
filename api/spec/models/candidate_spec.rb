require "rails_helper"

RSpec.describe Candidate, type: :model do
  it "requires a name" do
    candidate = Candidate.new(name: nil)

    expect(candidate).not_to be_valid
    expect(candidate.errors[:name]).to be_present
  end

  describe ".results" do
    it "returns totals and per-candidate percentages" do
      a = Candidate.create!(name: "A")
      b = Candidate.create!(name: "B")
      Vote.create!(candidate: a)
      Vote.create!(candidate: a)
      Vote.create!(candidate: b)

      results = Candidate.results

      expect(results[:total_votes]).to eq(3)
      expect(results[:candidates]).to contain_exactly(
        { id: a.id, name: "A", votes: 2, percentage: 66.67 },
        { id: b.id, name: "B", votes: 1, percentage: 33.33 }
      )
    end

    it "returns zero percentages when there are no votes" do
      a = Candidate.create!(name: "A")

      results = Candidate.results

      expect(results[:total_votes]).to eq(0)
      expect(results[:candidates]).to eq([{ id: a.id, name: "A", votes: 0, percentage: 0.0 }])
    end
  end
end
