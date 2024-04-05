DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS movies_to_genres;
DROP TABLE IF EXISTS user_to_movie_liked;

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
    movie_id INT NOT NULL,
    rating INTEGER,
    external_review BOOLEAN NOT NULL, --if true, fill external_id. Else fill user_id
    user_id VARCHAR(50),
    external_id VARCHAR(50)
);

CREATE TABLE user_to_movie_liked (
     user_id VARCHAR(50) NOT NULL,
     movie_id INT NOT NULL
);

ALTER TABLE movies_to_genres
    ADD CONSTRAINT FK_movie_id
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id);

ALTER TABLE movies_to_genres
    ADD CONSTRAINT FK_genre_id
        FOREIGN KEY (genre_id) REFERENCES genres(genre_id);

ALTER TABLE reviews
    ADD CONSTRAINT FK_internal_review_id
        FOREIGN KEY (user_id) REFERENCES users(username);

ALTER TABLE reviews
    ADD CONSTRAINT FK_external_review_id
        FOREIGN KEY (external_id) REFERENCES external_reviewers(reviewer_id);

ALTER TABLE reviews
    ADD CONSTRAINT FK_movie_id
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id);

ALTER TABLE user_to_movie_liked
    ADD CONSTRAINT FK_user_id
        FOREIGN KEY (user_id) REFERENCES users(username);

ALTER TABLE user_to_movie_liked
    ADD CONSTRAINT FK_movie_id
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id);



