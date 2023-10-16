DROP TABLE IF EXISTS likes;

CREATE TABLE IF NOT EXISTS likes (
	id serial PRIMARY KEY,
	video_id INT NOT NULL UNIQUE,
	likes_counter INT DEFAULT 0 NOT NULL,
	created_on TIMESTAMP DEFAULT current_timestamp NOT NULL
);