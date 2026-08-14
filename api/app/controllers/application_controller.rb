class ApplicationController < ActionController::API
  rescue_from StandardError, with: :handle_internal_error

  private

  def handle_internal_error(exception)
    Rails.logger.error("unhandled exception: #{exception.class} #{exception.message}")
    render json: { error: 'internal server error' }, status: :internal_server_error
  end
end
