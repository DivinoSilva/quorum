class CreateVotes < ActiveRecord::Migration[7.0]
  def change
    create_table :votes do |t|
      t.references :candidate, null: false, foreign_key: true, index: false
      t.string :voter_ip_masked

      t.timestamps
    end

    add_index :votes, %i[candidate_id created_at]
    add_index :votes, :created_at
  end
end
