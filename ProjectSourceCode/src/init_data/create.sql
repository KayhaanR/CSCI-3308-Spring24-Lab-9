DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS movies_to_genres;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS external_reviewers;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS genres;

CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY, --username equivalent to reviewer_id
    password VARCHAR(60) NOT NULL
);

CREATE TABLE external_reviewers ( --reviewer pulled from other website
    reviewer_id VARCHAR(50) PRIMARY KEY,
    source VARCHAR(50) NOT NULL
);

CREATE TABLE movies (
    movie_id INT PRIMARY KEY, --movies might have the same name
    image_path VARCHAR(80),
    name VARCHAR(50) NOT NULL,
    description VARCHAR(350),
    year DATE NOT NULL
);

CREATE TABLE genres (
    genre_id INT PRIMARY KEY,
    name VARCHAR (100) NOT NULL
);

CREATE TABLE movies_to_genres (
  movie_id INT NOT NULL,
  genre_id INT NOT NULL
);

CREATE TABLE reviews (
     review_id INTEGER PRIMARY KEY, --Probably sequential
     reviewer_id VARCHAR(50) NOT NULL, --maps to users or external reviewers
     movie_id INT NOT NULL,
     rating INTEGER
);