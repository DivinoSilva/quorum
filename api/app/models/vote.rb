class Vote < ApplicationRecord
  belongs_to :candidate

  def self.hourly_totals
    group("date_trunc('hour', created_at)").order(Arel.sql("date_trunc('hour', created_at)")).count.map do |hour, total|
      { hour: hour.iso8601, total: total }
    end
  end
end
