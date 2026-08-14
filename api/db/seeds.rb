Candidate.find_or_create_by!(name: 'Ada Lovelace') do |candidate|
  candidate.photo_url = 'https://i.pravatar.cc/300?img=47'
end

Candidate.find_or_create_by!(name: 'Alan Turing') do |candidate|
  candidate.photo_url = 'https://i.pravatar.cc/300?img=12'
end
