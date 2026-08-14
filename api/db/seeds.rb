Candidate.find_or_create_by!(name: 'Candidato A') do |candidate|
  candidate.photo_url = 'https://ui-avatars.com/api/?name=Candidato+A&background=2563eb&color=ffffff&size=128'
end

Candidate.find_or_create_by!(name: 'Candidato B') do |candidate|
  candidate.photo_url = 'https://ui-avatars.com/api/?name=Candidato+B&background=06b6d4&color=ffffff&size=128'
end
