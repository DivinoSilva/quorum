class CreateCandidates < ActiveRecord::Migration[7.0]
  def change
    create_table :candidates do |t|
      t.string :name, null: false
      t.string :photo_url

      t.timestamps
    end
  end
end
