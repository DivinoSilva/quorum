require 'ipaddr'

class VotesController < ApplicationController
  def create
    candidate = Candidate.find_by(id: params[:candidate_id])
    return reject_unknown_candidate unless candidate

    vote = Vote.create!(candidate: candidate, voter_ip_masked: masked_ip)
    VOTES_COUNTER.increment(labels: { candidate_id: candidate.id })
    Rails.logger.info("vote created id=#{vote.id} candidate_id=#{candidate.id}")

    render json: { vote: { id: vote.id, candidate_id: candidate.id }, results: Candidate.results }, status: :created
  end

  private

  def reject_unknown_candidate
    Rails.logger.warn("vote rejected: candidate_id=#{params[:candidate_id].inspect} not found")
    render json: { error: 'candidate not found' }, status: :not_found
  end

  def masked_ip
    ip = request.remote_ip
    return nil if ip.blank?

    addr = IPAddr.new(ip)
    addr.ipv4? ? addr.mask(24).to_s : addr.mask(48).to_s
  rescue IPAddr::Error
    nil
  end
end
