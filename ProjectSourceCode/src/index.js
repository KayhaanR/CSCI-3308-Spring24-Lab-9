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


const apiKey = '61bad045';

const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});


const dbConfig = {
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

// app.use(express.static(path.join(__dirname, "/resources")));
// app.use('/uploads',express.static('uploads'))

db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
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

function addReviews(x) {
  const fetch = require('node-fetch');

  const url = `https://api.themoviedb.org/3/movie/${x}/reviews?language=en-US&page=1`;
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
      for(const reviews of json.results) {
        if(reviews.content.length < 4900) { 
          db.any('INSERT INTO external_reviewers(reviewer_id, source) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM external_reviewers WHERE reviewer_id = $1)', [reviews.author, "tmdb"])
          .then(() => {
            return db.any('INSERT INTO reviews (movie_id, rating, external_review, avatar_path, external_id, review_text) VALUES ($1, $2, $3, $4, $5, $6)', [x, reviews.author_details.rating, true, reviews.author_details.avatar_path, reviews.author, reviews.content ]);
          })
          .catch(
            console.log('whoops')
          )
          
        }
      }
      
    })
    .catch(err => console.error('error:' + err));
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
      console.log(data)
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

app.get('/forYou', (req, res) => {
  res.render('pages/forYou');
});

app.get('/profile', async (req, res) => {
  try {
    const username = req.session.user;
    // fetch the user's profile picture path from the database
    const userData = await db.one('SELECT profile_picture FROM users WHERE username = $1', [username]);
    console.log(userData);
    // pass the user's profile picture path to the rendering engine
    res.render('pages/profile', {
      profile_picture: userData ? userData.profile_picture : '/personicon.jpg',
      username: req.session.user
    });
  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).send('Internal Server Error');
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

/*
app.use('/a',express.static('/b'));
Above line would serve all files/folders inside of the 'b' directory
And make them accessible through http://localhost:3000/a.
*/
app.use(express.static(__dirname + '/'));
app.use('/uploads', express.static('uploads'));

app.post('/profile', upload.single('profile-file'), function (req, res, next) {
  // req.file is the `profile-file` file
  // req.body will hold the text fields, if there were any
  const username = req.session.user;
  const profilePicturePath = req.file.path;
  db.one('UPDATE users SET profile_picture = $1 WHERE username = $2 returning *', [profilePicturePath, username]);
  console.log(JSON.stringify(req.file))
  // var response = '<a href="/">Home</a><br>'
  // response += "Files uploaded successfully.<br>"
  // response += `<img src="${req.file.path}" /><br>`

  res.render('pages/profile', {
    profile_picture: req.file.path,
  });
})


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

  db.any('INSERT INTO user_to_movie_liked (user_id, movie_id) VALUES ($1, $2)', [user, movieID])

})

app.get('/movieDetails', (req, res) => {
  const movieId = req.query.id
  db.one('SELECT * FROM movies WHERE movie_id = $1', [movieId]).then(data => {
    db.any('SELECT * FROM reviews WHERE movie_id = $1', [movieId]).then(reviewData => {
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
        reviews: reviewData
      })
    })
  })

})

db.any('SELECT COUNT(*) FROM movies')
  .then(data => {
    const count = data[0].count;
    if (count === '0') {
      populateGenreId()
      for (let i = 1; i < 2; i++) {
        fetchMovieData(i);
      }
    }
  })


module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
