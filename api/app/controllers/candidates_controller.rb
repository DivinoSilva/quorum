class CandidatesController < ApplicationController
  def index
    render json: { candidates: Candidate.order(:id).select(:id, :name, :photo_url) }
  end
end
