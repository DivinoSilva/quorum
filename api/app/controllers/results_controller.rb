class ResultsController < ApplicationController
  def index
    if params[:group_by].present?
      render_grouped
    else
      render json: cached_results
    end
  end

  private

  def render_grouped
    unless params[:group_by] == 'hour'
      render json: { error: "unsupported group_by, expected 'hour'" }, status: :bad_request
      return
    end

    date = parse_date(params[:date])

    unless date
      render json: { error: 'invalid date, expected YYYY-MM-DD' }, status: :bad_request
      return
    end

    render json: { date: date.iso8601, hours: Vote.hourly_totals(date) }
  end

  def cached_results
    Rails.cache.fetch('results', expires_in: 2.seconds) { Candidate.results }
  end

  def parse_date(value)
    return Time.zone.today if value.blank?

    Date.iso8601(value)
  rescue ArgumentError
    nil
  end
end
