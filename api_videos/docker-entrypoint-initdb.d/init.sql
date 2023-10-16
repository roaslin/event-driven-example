DROP TABLE IF EXISTS videos;

CREATE TABLE IF NOT EXISTS videos (
	id serial PRIMARY KEY,
	title VARCHAR ( 200 ) NOT NULL,
    duration INT DEFAULT 0 NOT NULL,
	likes INT DEFAULT 0 NOT NULL,
	created_on TIMESTAMP DEFAULT current_timestamp NOT NULL
);