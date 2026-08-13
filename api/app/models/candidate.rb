class Candidate < ApplicationRecord
  has_many :votes, dependent: :restrict_with_error

  validates :name, presence: true

  def self.results
    counts = Vote.group(:candidate_id).count
    total = counts.values.sum

    {
      total_votes: total,
      candidates: order(:id).map do |candidate|
        count = counts[candidate.id] || 0
        {
          id: candidate.id,
          name: candidate.name,
          votes: count,
          percentage: total.zero? ? 0.0 : (count * 100.0 / total).round(2)
        }
      end
    }
  end
end
