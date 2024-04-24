DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS movies_to_genres;
DROP TABLE IF EXISTS user_to_movie_liked;
DROP TABLE IF EXISTS awards;
DROP TABLE IF EXISTS movies_to_actors;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS external_reviewers;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS actors;

CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY, --username equivalent to reviewer_id
    password VARCHAR(60) NOT NULL,
    profile_picture VARCHAR(255)
);

CREATE TABLE external_reviewers ( --reviewer pulled from other website
    reviewer_id VARCHAR(50) PRIMARY KEY,
    source VARCHAR(50) NOT NULL
);

CREATE TABLE movies (
    movie_id SERIAL PRIMARY KEY, --movies might have the same name
    image_path VARCHAR(150),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(450),
    year VARCHAR(20) NOT NULL,
    director VARCHAR(100) NOT NULL,
    language VARCHAR(250) NOT NULL,
    -- Normalize ratings before calculating total rating. --
    metacritic_rating VARCHAR(5),
    imdb_rating VARCHAR(5),
    tmdb_rating NUMERIC(3, 0),
    -- After other ratings filled, calculate our rating. --
    our_rating NUMERIC(3, 1),

    youtube_link VARCHAR(100)
);

CREATE TABLE actors (
    name VARCHAR(100) PRIMARY KEY
);

CREATE TABLE movies_to_actors (
    movie_id INTEGER NOT NULL,
    actor_name VARCHAR(100) NOT NULL
);

CREATE TABLE awards (
    name VARCHAR(100) PRIMARY KEY,
    year VARCHAR(20) NOT NULL,
    movie_id INTEGER NOT NULL -- Maps to movie winning award
);

CREATE TABLE genres (
    genre_id INT PRIMARY KEY, -- These could be made the same thing.
    name VARCHAR (100) NOT NULL
);

CREATE TABLE movies_to_genres (
    movie_id INT NOT NULL,
    genre_id INT NOT NULL
);

CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY, --Probably sequential
    movie_id INT NOT NULL,
    rating INTEGER,
    external_review BOOLEAN NOT NULL, --if true, fill external_id. Else fill user_id
    avatar_path VARCHAR(100),
    user_id VARCHAR(50),
    review_text VARCHAR(5000),
    external_id VARCHAR(50)
);

CREATE TABLE user_to_movie_liked (
     user_id VARCHAR(50) NOT NULL,
     movie_id INT NOT NULL
);

ALTER TABLE movies_to_actors
    ADD CONSTRAINT FK_movie_id
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id);

ALTER TABLE movies_to_actors
    ADD CONSTRAINT FK_actor_name
        FOREIGN KEY (actor_name) REFERENCES actors(name);

ALTER TABLE awards
    ADD CONSTRAINT FK_movie_id
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id);

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



