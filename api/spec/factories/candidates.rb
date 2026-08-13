FactoryBot.define do
  factory :candidate do
    sequence(:name) { |n| "Candidate #{n}" }
  end
end
