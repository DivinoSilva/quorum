class Candidate < ApplicationRecord
  has_many :votes

  validates :name, presence: true
end
