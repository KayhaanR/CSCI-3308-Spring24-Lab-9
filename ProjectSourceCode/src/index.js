const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const db = require('./resources/js/db.js');
const {predictionRouter, recommendMovies} = require('./resources/js/predictionModel/predictScript.js');

const apiKey = '61bad045';

const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
  extended: true,
}));


// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// AJAX call function

async function addReviews(x) {
  const fetch = require('node-fetch');

  const url = `https://api.themoviedb.org/3/movie/${x}/reviews?language=en-US&page=1`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNWI0NzEyYzk4OWE4MWZlMTRhZmYzZTdlZGRlYTE1MyIsInN1YiI6IjY2MTQ1ZDEwYTZhNGMxMDE2MmJjZWVmMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bLYsk7fx4GQ4U4XWkIO0EDxr15I8mQeT9bmw4GH-LnY'
    }
  };

  try {
    await db.tx(async t => { 
      const res = await fetch(url, options); 
      const json = await res.json();
      for (const review of json.results) {
        if (review.content.length < 4900) {
          await t.none('INSERT INTO external_reviewers (reviewer_id, source) VALUES ($1, $2) ON CONFLICT DO NOTHING', [review.author, 'tmdb']);
          await t.none('INSERT INTO reviews (movie_id, rating, external_review, avatar_path, external_id, review_text) VALUES ($1, $2, $3, $4, $5, $6)', [x, review.author_details.rating, true, review.author_details.avatar_path, review.author, review.content]);
        }
      }
    });
  } catch (error) {
    console.error('Error adding reviews:', error);
  }
}

function populateGenreId() {
  const fetch = require('node-fetch');

  const url = 'https://api.themoviedb.org/3/genre/movie/list?language=en';
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNWI0NzEyYzk4OWE4MWZlMTRhZmYzZTdlZGRlYTE1MyIsInN1YiI6IjY2MTQ1ZDEwYTZhNGMxMDE2MmJjZWVmMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bLYsk7fx4GQ4U4XWkIO0EDxr15I8mQeT9bmw4GH-LnY'
    }
  };
  fetch(url, options)
    .then(res => res.json())
    .then(json => {
      for (const genreData of json.genres) {
        db.any('INSERT INTO genres (genre_id, name) VALUES ($1, $2)', [genreData.id, genreData.name]);
      }
    })
}

function fetchMovieData(x) {
  const fetch = require('node-fetch');


  var url = `https://api.themoviedb.org/3/movie/top_rated?language=en-US&page=${x}`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNWI0NzEyYzk4OWE4MWZlMTRhZmYzZTdlZGRlYTE1MyIsInN1YiI6IjY2MTQ1ZDEwYTZhNGMxMDE2MmJjZWVmMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bLYsk7fx4GQ4U4XWkIO0EDxr15I8mQeT9bmw4GH-LnY'
    }
  };

  fetch(url, options)
    .then(res => res.json())
    .then(json => {
      for (const tmdbData of json.results) {

      
        // Fetch the videos data for the movie
        const videosUrl = `https://api.themoviedb.org/3/movie/${tmdbData.id}/videos?language=en-US`;
        fetch(videosUrl, options)
          .then(res => res.json())
          .then(videosData => {
            // Extract the YouTube video key from the videos data
            let youtubeLink = '';
            for (const video of videosData.results) {
              if (video.site === 'YouTube' && video.type === 'Trailer') {
                youtubeLink = `https://www.youtube.com/embed/${video.key}`;
                break;
              }
            }

            // Fetch additional data from the OMDB API
            url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${tmdbData.title}`;
            fetch(url)
              .then(response => response.json())
              .then(omdbData => {
                //CHECKS IF MOVIE IS IN OMDB
                if (omdbData.Title != null) {

                  //INSERT MOVIE INTO DB
                  db.any(`INSERT INTO movies (movie_id, image_path, name, year, description,  director, language, metacritic_rating, imdb_rating, tmdb_rating, youtube_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                    [tmdbData.id, omdbData.Poster, omdbData.Title, omdbData.Year, omdbData.Plot, omdbData.Director, omdbData.Language, omdbData.Metascore, omdbData.imdbRating, tmdbData.vote_average, youtubeLink]).then(data => {
                      //INSERT MOVIE INTO GENRE TO MOVIE Table
                      for (const genreId of tmdbData.genre_ids) {
                        db.any('INSERT INTO movies_to_genres (movie_id, genre_id) VALUES ($1, $2)', [tmdbData.id, genreId]);
                      }
                    })
              
                    addReviews(tmdbData.id)
                }
              })
          });
      }
    })
    .catch(err => console.error('error:' + err));
}

const avatarOptions = [
  { id: 1, path: '/resources/img/avatar1.jpg' },
  { id: 2, path: '/resources/img/avatar2.jpg' },
  { id: 3, path: '/resources/img/avatar3.jpg' },
  { id: 4, path: '/resources/img/avatar4.jpg' },
  { id: 5, path: '/resources/img/avatar5.jpg' }
]


app.get('/', (req, res) => {
  res.redirect('/login');
})

app.get('/login', (req, res) => {
  console.log('testing');
  res.render('pages/login');
})

app.post('/login', (req, res) => {
  db.any('SELECT * FROM users WHERE username = $1', [req.body.username])
    .then(data => {
      // check if password from request matches with password in DB
      if (data.length === 0) {
        res.render('pages/login', {
          error: true,
          message: "Username Not Found",
        });
      }
      else {
        bcrypt.compare(req.body.password, data[0].password)
          .then(match => {
            if (match) {
              req.session.user = req.body.username;
              req.session.save();
              res.status(200).redirect('/home')
            }
            else {
              res.status(400).render('pages/login', {
                error: true,
                message: "Wrong Password",
              });
            }
          })
          .catch(err => {
            res.render('pages/login', {
              error: true,
              message: err.message,
            });
          });
      }

    })
    .catch(err => {
      res.render('pages/login', {
        error: true,
        message: err.message,
      });
    });
});

app.get('/home', (req, res) => {
  const query = "SELECT movie_id, image_path FROM movies";
  db.any(query)
    .then(data => {
      res.render('pages/home', {
        result: data
      })
    })

});

app.get('/flix', (req, res) => {
  const query = "SELECT youtube_link FROM movies";
  db.any(query)
    .then(data => {
      console.log(data);  // Log the data
      res.render('pages/flix', {
        flix_data: JSON.stringify(data)  // Convert 'data' to a JSON string
      })
    })
});

app.get('/forYou', async (req, res) => {
  const username = req.session.user;
  if (!username) {
    res.redirect('/login');
    return;
  }

  try {
    const recommendations = await recommendMovies(username, 20);
    if (recommendations.length === 0) {
      if (recommendations.message === 'No liked movies found for this user to base recommendations on.') {
        res.render('pages/forYou', { recommendations: [], message: "Please like some movies so we can recommend you similar movies." });
      } else {
        res.render('pages/forYou', { recommendations: [], message: "No recommendations available. Please like more movies to improve recommendations." });
      }
    } else {
      const movieIDs = recommendations.map(rec => rec.movie_id);
      const movieDetails = await db.any(`
        SELECT m.movie_id, m.image_path, m.name, m.description, m.year, m.director, m.language, m.metacritic_rating, m.imdb_rating, m.tmdb_rating, m.our_rating, m.youtube_link
        FROM movies m
        WHERE m.movie_id = ANY($1)`, [movieIDs]);

      const enrichedRecommendations = movieDetails.map(movie => {
        const recommendation = recommendations.find(rec => rec.movie_id === movie.movie_id);
        return {
          ...movie,
          score: (recommendation.score).toFixed(0)
        };
      });

      res.render('pages/forYou', { recommendations: enrichedRecommendations });
    }
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    res.render('pages/forYou', { recommendations: [], message: 'Error loading recommendations. Please try again later.' });
  }
});

app.post('/search', async (req, res) => {
  console.log(req.body.query)
  try {
    const searchQuery = req.body.query;
    const movies = await db.query('SELECT name, image_path, movie_id FROM movies WHERE name ILIKE $1', [`%${searchQuery}%`]);
    console.log(movies)
    res.json(movies);
  }
  catch (err) {
    console.error('Error searching for movie:', err);
    res.status(500).json({ error: 'An error occurred while searching for movie' });
  }

});

app.get('/profile', async (req, res) => {
  if(req.session.user == null) {
    res.redirect('/login')
  }
  else {
    try {
      const username = req.session.user;
      // fetch the user's profile picture path from the database
      const userData = await db.one('SELECT profile_picture FROM users WHERE username = $1;', [username]);
      
      var avatar_id;
      for (let i=0 ; i< avatarOptions.length; i++){
        if (userData.profile_picture == avatarOptions[i].path){
          avatar_id = avatarOptions[i].id
        }
      }
      
      // console.log(JSON.stringify(userData));
      // console.log("This is the userdata: " + userData.profile_picture);
      // console.log("This is the userdata pfp: " + avatar_id);
      // userData.profile_picture = req.session.profile_picture;
      // pass the user's profile picture path
      res.render('pages/profile', {
        profile_picture: (userData.profile_picture),
        username: req.session.user,
        selectedAvatar : avatar_id,
        avatarOptions : avatarOptions
      });
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      res.status(500).send('Internal Server Error');
    }
  }
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })

app.use(express.static(__dirname + '/'));
app.use('/resources', express.static('resources'));
app.use(predictionRouter);

app.post('/profile', async (req, res) => {
  try {
    const username = req.session.user;
    const selectedAvatarId = req.body.avatarId; // assuming the form sends the selected avatar ID
    console.log(selectedAvatarId);
    
    const selectedAvatar = avatarOptions.find(avatar => avatar.id === parseInt(selectedAvatarId));
    console.log(selectedAvatar);
    if (!selectedAvatar) {
      throw new Error('Invalid avatar ID');
    }
    // update the user's profile with the selected avatar
    const query = await db.one('UPDATE users SET profile_picture = $1 WHERE username = $2 returning *', [selectedAvatar.path, username]);
    console.log(query);
    req.session.profile_picture = selectedAvatar.path;
    const f = req.session.profile_picture;
    res.render('pages/profile', {
      username: req.session.user,
      selectedAvatar: selectedAvatar,
      profile_picture: f
    }); 
  } catch (error) {
    console.error('Error selecting avatar:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/register', (req, res) => {
  res.render('pages/register');
  console.log('testing');
});

app.post('/register', async (req, res) => {
  if (req.body.username.length < 4) {
    res.status(400).render('pages/register', {
      error: true,
      message: "Username is too short",
    });
  }
  else if (req.body.password.length < 4) {
    res.status(400).render('pages/register', {
      error: true,
      message: "Password is too short",
    });
  }
  else if (req.body.password.length > 50 || req.body.username.length > 50) {
    res.status(400).render('pages/register', {
      error: true,
      message: "Username or password too long",
    });
  }
  else {
    db.any('SELECT * FROM users WHERE username = $1', [req.body.username])
      .then(async data => {
        if (data.length == 0) {
          const hash = await bcrypt.hash(req.body.password, 10);

          await db.any(`INSERT INTO users (username, password) VALUES ($1, $2);`,
            [req.body.username, hash]).then(data => {
              res.redirect('/login')

            })
            .catch(err => {
              res.status(400).redirect('/register')
            });
        }
        else {
          res.status(400).render('pages/register', {
            error: true,
            message: "Username already exists",
          });

        }
      })
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
})

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.post('/addReview', (req, res) => {
  const movieID = req.query.movieID
  const user = req.session.user

  db.any('SELECT * FROM reviews WHERE user_id = $1', [user]).then(data => {
    if(data.length == 0) {
      db.one('SELECT profile_picture FROM users WHERE username = $1', [user]).then(data => {
        db.any('INSERT INTO reviews (movie_id, rating, external_review, avatar_path, user_id, review_text) VALUES ($1, $2, $3, $4, $5, $6)',
       [movieID, req.body.rating, false, data.profile_picture, user, req.body.review]);
      })
    }
  })

  res.redirect(`/movieDetails?id=${movieID}`)
})

app.post('/likeMovie', (req, res) => {
  const movieID = req.query.movieID
  const user = req.session.user

  db.any('SELECT * FROM user_to_movie_liked WHERE user_id = $1 AND movie_id = $2', [user, movieID]).then(data => {
    if(data.length == 0) {
      db.any('INSERT INTO user_to_movie_liked (user_id, movie_id) VALUES ($1, $2)', [user, movieID])
    }
    else {
      db.any('DELETE FROM user_to_movie_liked WHERE user_id = $1 AND movie_id = $2', [user, movieID])
    }
  })
  res.redirect(`/movieDetails?id=${movieID}`)
})

app.get('/movieDetails', (req, res) => {
  const movieId = req.query.id;
  db.one('SELECT * FROM movies WHERE movie_id = $1', [movieId]).then(data => {
    db.any('SELECT * FROM reviews WHERE movie_id = $1', [movieId]).then(reviewData => {
      let isLiked = false; 
      if(req.session.user != null) {
        db.any('SELECT * FROM user_to_movie_liked WHERE user_id = $1 AND movie_id = $2', [req.session.user, movieId]).then(likedData => {
          if(likedData.length != 0) {
            isLiked = true;
          }
          res.render('pages/movieDetails', {
            id: movieId,
            user: req.session.user,
            name: data.name,
            image: data.image_path,
            plot: data.description,
            director: data.director,
            metacriticRating: data.metacritic_rating,
            imdbRating: data.imdb_rating,
            tmdbRating: data.tmdb_rating,
            year: data.year,
            language: data.language,
            reviews: reviewData,
            liked: isLiked
          });
        }).catch(error => {
          console.error('Error retrieving liked data:', error);
          res.status(500).send('Internal Server Error');
        });
      } else {
        res.render('pages/movieDetails', {
          id: movieId,
          user: null,
          name: data.name,
          image: data.image_path,
          plot: data.description,
          director: data.director,
          metacriticRating: data.metacritic_rating,
          imdbRating: data.imdb_rating,
          tmdbRating: data.tmdb_rating,
          year: data.year,
          language: data.language,
          reviews: reviewData,
          liked: isLiked
        });
      }
    }).catch(error => {
      console.error('Error retrieving reviews:', error);
      res.status(500).send('Internal Server Error');
    });
  }).catch(error => {
    console.error('Error retrieving movie data:', error);
    res.status(500).send('Internal Server Error');
  });
});


db.any('SELECT COUNT(*) FROM movies')
  .then(data => {
    const count = data[0].count;
    if (count === '0') {
      populateGenreId()
      for (let i = 1; i < 5; i++) {
        fetchMovieData(i);
      }
    }
  })


module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
