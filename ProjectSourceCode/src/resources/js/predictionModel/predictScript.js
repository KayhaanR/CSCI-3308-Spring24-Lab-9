const express = require('express');
const predictionRouter = express.Router();
const db = require('../db.js');

/**
 * Calc Euclidean distance between feature lists
 * Unused but may be useful in the future
 *
 * @param {array<number>} lst1: a set of features scores
 * @param {array<number>} lst2: a set of features scores
 * @return {number} the euclidean distance between the two feature lists
 */
function euclideanDistance(lst1, lst2) {
  if (lst1.length !== lst2.length) {
    throw new Error('Features must be of the same length');
  }

  let sumOfSquares = 0;
  for (let i = 0; i < lst1.length; i++) {
    sumOfSquares += (lst1[i] - lst2[i]) ** 2;
  }

  return Math.sqrt(sumOfSquares);
}

/** Fetches movie features from the db to be used to calculate like scores.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of movie objects:
 *        - movie_id: the movie_id (int)
 *        - year: the release year
 *        - director: the director name
 *        - actors: an array of actor names
 *        - genres: an array of genre names
 *        - language: the language
 *        - liked_by: Array of user_ids of users who have liked the movie
 */
async function getMoviesWithFeatures() {
  const query = `
        SELECT
            m.movie_id,
            m.year,
            m.director,
            m.language,
            array_agg(DISTINCT a.name) AS actors,
            array_agg(DISTINCT g.name) AS genres,
            array_agg(DISTINCT ul.user_id) AS liked_by
        FROM movies m
            LEFT JOIN movies_to_actors ma ON ma.movie_id = m.movie_id
            LEFT JOIN actors a ON ma.actor_name = a.name
            LEFT JOIN movies_to_genres mg ON mg.movie_id = m.movie_id
            LEFT JOIN genres g ON mg.genre_id = g.genre_id
            LEFT JOIN user_to_movie_liked ul ON ul.movie_id = m.movie_id
        GROUP BY m.movie_id
        ORDER BY m.movie_id;
    `;

  try {
    return await db.any(query);
  } catch (error) {
    console.error('Error fetching movie features:', error);
    throw error;
  }
}

/**
 * Function to get recommended movies for a user
 *
 * @param {string} username: the username
 * @param {int} N: the number of movies to recommend
 * @return {Promise<Array>} An array of movie recommendation objects:
 *        - movie_id: an int movie_id
 *        - score: the like score of the movie as a double
 */
async function recommendMovies(username, N = 5) {
  try {
    const allMovies = await getMoviesWithFeatures();

    // Split movies by whether the user liked them
    const likedMovies = allMovies.filter(movie => movie.liked_by.includes(username));
    const otherMovies = allMovies.filter(movie => !movie.liked_by.includes(username));

    // Handle cases where there are no liked movies
    if (likedMovies.length === 0) {
      return { message: 'No liked movies found for this user to base recommendations on.', recommendations: [] };
    }

    // Preprocess
    const likedFeatures = preprocessFeatures(likedMovies);

    // Calculate scores & sort
    const recommendations = otherMovies.map(movie => {
      const movieFeatures = preprocessSingleMovie(movie);
      const score = likeValue(likedFeatures, movieFeatures);
      return { movie_id: movie.movie_id, score: score || 0 };
    }).filter(item => item.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, N);

    return recommendations;
  } catch (error) {
    console.error('Error in recommendMovies:', error);
    throw error;
  }
}

/**
 * Preprocess features into a usable format for similarity calculation
 *
 * @param {Array} movies: an array of movie objects:
 *        - year: the release year
 *        - director: the director name
 *        - actors: an array of actor names
 *        - genres: an array of genre names
 *        - language: the language
 * @return {Object} An object representing the combined features:
 *        - years: an array of movie release years
 *        - directors: a Map object: {string director.name => int count}
 *        - actors: a Map object: {string actor.name => int count}
 *        - genres: a Map object: {string genre.name => int count}
 *        -languages: A Map object: {string language => int count}
 */
function preprocessFeatures(movies) {
  let featureList = {
    years: [],
    directors: new Map(),
    actors: new Map(),
    genres: new Map(),
    languages: new Map()
  };

  movies.forEach(movie => {
    featureList.years.push(movie.year);
    incrementMap(featureList.directors, movie.director);
    movie.actors.forEach(actor => incrementMap(featureList.actors, actor));
    movie.genres.forEach(genre => incrementMap(featureList.genres, genre));
    incrementMap(featureList.languages, movie.language);
  });

  return featureList;
}

/** Helper function to increment count in a map
 *
 * @param {Map} map: the map
 * @param {string} key: the key to increment count for
 */
function incrementMap(map, key) {
  if (map.has(key)) {
    map.set(key, map.get(key) + 1);
  } else {
    map.set(key, 1);
  }
}

/** Preprocess a single movie's features into a structured object for similarity calc
 *
 * @param {Object} movie - Movie object containing:
 *        - year: the release year
 *        - director: the director name
 *        - actors: an array of actor names
 *        - genres: an array of genre names
 *        - language: the language
 * @returns {Object} An object with structured features:
 *        - years: an array containing the movie's release year
 *        - directors: a Map object: {string director.name -> int 1}
 *        - actors: a Map object: {string actor.name -> int 1}
 *        - genres: a Map object: {string genre.name -> int 1}
 *        - languages: a Map object: {string language -> int 1}
 */
function preprocessSingleMovie(movie) {
  return {
    years: [movie.year],
    directors: new Map([[movie.director, 1]]),
    actors: new Map(movie.actors.map(actor => [actor, 1])),
    genres: new Map(movie.genres.map(genre => [genre, 1])),
    languages: new Map([[movie.language, 1]])
  };
}

/** Calculate the similarity score based on predefined feature importance
 *
 * @param {Object} likedFeatures - An object representing aggregated features of liked movies:
 *        - years: an array of movie release years
 *        - directors: a Map object: {string director.name => int count}
 *        - actors: a Map object: {string actor.name => int count}
 *        - genres: a Map object: {string genre.name => int count}
 *        - languages: a Map object: {string language => int count}
 * @param {Object} movieFeatures - An object representing the features of a single movie:
 *        - years: an array containing the movie's release year
 *        - directors: a Map object: {string director.name -> int 1}
 *        - actors: a Map object: {string actor.name -> int 1}
 *        - genres: a Map object: {string genre.name -> int 1}
 *        - languages: a Map object: {string language -> int 1}
 * @returns {number} The calculated like score where a higher value means a higher similarity
 */
function likeValue(likedFeatures, movieFeatures) {
  let similarityScores = [];

  // Calculate year similarity:
  const yearDiff = likedFeatures.years.reduce((acc, year) => acc + Math.abs(year - movieFeatures.years[0]), 0) / likedFeatures.years.length;
  similarityScores.push(1 / (1 + yearDiff));

  // Calculate similarity for categorical features
  ['directors', 'actors', 'genres', 'languages'].forEach(feature => {
    similarityScores.push(calculateCategoricalSimilarity(likedFeatures[feature], movieFeatures[feature]));
  });

  // Calculate the Euclidean distance of all the scores
  const euclidScore = Math.sqrt(similarityScores.reduce((acc, score) => acc + score * score, 0));

  const maxPossibleScore = Math.sqrt(similarityScores.length); //Theoretical
  const normalizedScore = (euclidScore / maxPossibleScore) * 100;

  return normalizedScore;
}

/** Helper function to calculate similarity for categorical features using a modified Jaccard index.
 *
 * @param {Map} likedMap: a Map of feature names to count: {string featureName => int count}
 * @param {Map} movieMap: a Map of feature names to count: {string featureName => int 1}
 * @returns {number} the similarity score
 */
function calculateCategoricalSimilarity(likedMap, movieMap) {
  let commonElements = 0;
  movieMap.forEach((count, key) => {
    if (likedMap.has(key)) {
      commonElements += likedMap.get(key);
    }
  });

  let totalElements = Array.from(likedMap.values()).reduce((acc, val) => acc + val, 0) +
      Array.from(movieMap.values()).reduce((acc, val) => acc + val, 0);

  if (totalElements === 0) {
    return 0;
  }

  const value = (2 * commonElements) / totalElements; // Jaccard index approximation
  return Math.pow(value, 0.3); //skewing results
}

predictionRouter.get('/recommendations/:username', async (req, res) => {
  const username = req.params.username;
  const count = req.query.count || 5;  // Default to 5 recommendations if no count specified
  try {
    const recommendations = await recommendMovies(username, parseInt(count));
    if (recommendations.length === 0) {
      res.status(404).json({ message: 'No recommendations found.' });
    } else {
      res.status(200).json(recommendations);
    }
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations', details: error.message });
  }
});

module.exports = {
  predictionRouter,
  recommendMovies
};

