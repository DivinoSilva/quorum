class Vote < ApplicationRecord
  belongs_to :candidate

  def self.hourly_totals(date = Time.zone.today)
    start_of_day = date.in_time_zone.beginning_of_day

    counts_by_hour = where(created_at: start_of_day..start_of_day.end_of_day)
                     .group("date_trunc('hour', created_at)")
                     .count
                     .each_with_object({}) { |(time, total), hash| hash[time.hour] = total }

    (0..23).map do |hour|
      { hour: (start_of_day + hour.hours).iso8601, total: counts_by_hour[hour] || 0 }
    end
  end
end
