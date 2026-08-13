Rails.application.routes.draw do
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'
  resources :candidates, only: [:index]
  resources :votes, only: [:create]

  get '/results', to: 'results#index'
  get '/results/hourly', to: 'results#hourly'

  get '/up', to: proc { [200, {}, ['OK']] }
end
