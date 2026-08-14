class Vote < ApplicationRecord
  belongs_to :candidate

  def self.hourly_totals(date = Time.zone.today)
    start_of_day = date.in_time_zone.beginning_of_day
    counts = counts_by_hour_and_candidate(start_of_day)
    candidates = Candidate.order(:id).to_a

    (0..23).map { |hour| hourly_entry(start_of_day, hour, candidates, counts) }
  end

  def self.counts_by_hour_and_candidate(start_of_day)
    where(created_at: start_of_day..start_of_day.end_of_day)
      .group("date_trunc('hour', created_at)", :candidate_id)
      .count
      .each_with_object({}) do |((time, candidate_id), total), hash|
        (hash[time.hour] ||= {})[candidate_id] = total
      end
  end
  private_class_method :counts_by_hour_and_candidate

  def self.hourly_entry(start_of_day, hour, candidates, counts)
    per_candidate = candidates.map do |candidate|
      { id: candidate.id, name: candidate.name, votes: counts.dig(hour, candidate.id) || 0 }
    end

    {
      hour: (start_of_day + hour.hours).iso8601,
      total: per_candidate.sum { |c| c[:votes] },
      candidates: per_candidate
    }
  end
  private_class_method :hourly_entry
end
