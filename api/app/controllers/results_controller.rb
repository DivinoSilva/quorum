class ResultsController < ApplicationController
  def index
    render json: cached_results
  end

  def hourly
    render json: { hours: Vote.hourly_totals }
  end

  private

  def cached_results
    Rails.cache.fetch('results', expires_in: 2.seconds) { Candidate.results }
  end
end
