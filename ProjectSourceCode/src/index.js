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

app.use(express.static(path.join(__dirname, "Resources")));
app.use(express.static('/uploads'))

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

app.use( bodyParser.urlencoded({
  extended:true,
}));


// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// AJAX call function

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
    for(const genreData of json.genres) {
      db.any('INSERT INTO genres (genre_id, name) VALUES ($1, $2)', [genreData.id, genreData.name]);
    }
  })
}

function fetchMovieData() {
  const fetch = require('node-fetch');

  populateGenreId()

  var url = 'https://api.themoviedb.org/3/movie/top_rated?language=en-US&page=1';
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
      for(const tmdbData of json.results) {
        url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${tmdbData.title}`;

        fetch(url)
          .then(response => response.json())
          .then(omdbData => {
            

              //CHECKS IF MOVIE IS IN OMDB
              if(omdbData.Title != null) {
                //INSERT MOVIE INTO DB
                db.any(`INSERT INTO movies (movie_id, image_path, name, year, description,  director, language, metacritic_rating, imdb_rating, tmdb_rating) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, 
                [tmdbData.id, omdbData.Poster, omdbData.Title, omdbData.Year, omdbData.Plot, omdbData.Director,  omdbData.Language, omdbData.Metascore, omdbData.imdbRating, tmdbData.vote_average]).then(data =>{
                  //INSERT MOVIE INTO GENRE TO MOVIE Table
                  for(const genreId of tmdbData.genre_ids) {
                    db.any('INSERT INTO movies_to_genres (movie_id, genre_id) VALUES ($1, $2)', [tmdbData.id, genreId]);
                  }
                })
       
                
            
              }
          })
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
  .then( data => {
      // check if password from request matches with password in DB
      if(data.length === 0) {
        res.render('pages/login', {
          error: true,
          message: "Username Not Found",
        });
      }
      else {
          bcrypt.compare(req.body.password, data[0].password)
          .then(match => {
              if(match) {
                  req.session.user = req.body.username;
                  req.session.save();     
                  res.status(200).render('pages/home')
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
  const query = "SELECT image_path FROM movies";
  db.any(query)
    .then(data => {
      res.render('pages/home', {
        image: data
      })
      console.log(data)
    })

});

app.get('/flix', (req, res) => {
  res.render('pages/flix');
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
    res.render('pages/profile', { profile_picture: userData ? userData.profile_picture : '/personicon.jpg' });
  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).send('Internal Server Error');
  }
});

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/'); // specify the destination directory
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname); // specify the filename
  }
});

// initialize multer with the specified storage
const upload = multer({ storage: storage });

// profile route with multer middleware
app.post('/profile', upload.single('profileImage'), async (req, res) => {
  // Multer saves the file in req.file
  if (req.file) {
    try {
      const username = req.session.user; 
      const profilePicturePath = req.file.filename;
      console.log(profilePicturePath);
      await db.one('UPDATE users SET profile_picture = $1 WHERE username = $2 returning *', [profilePicturePath, username]);
      
      console.log('Profile picture path updated in the database.');

      
      const defaultPicture = '/personicon.jpg';
      const previousProfilePicture = await db.oneOrNone('SELECT profile_picture FROM users WHERE username = $1', [username]);
      if (previousProfilePicture && previousProfilePicture.profile_picture !== defaultPicture) {
        const filePath = path.join('uploads/', previousProfilePicture.profile_picture);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error deleting previous profile picture:', err);
          } else {
            console.log('Previous profile picture deleted successfully.');
          }
        });
      }

      res.redirect('/profile');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(400).send('No file uploaded.');
  }
});


app.get('/register', (req, res) => {
  res.render('pages/register');
  console.log('testing');
});

app.post('/register', async (req, res) => {
  if(req.body.username.length < 4) {
    res.status(400).render('pages/register', {
      error: true,
      message: "Username is too short",
    });
  }
  else if(req.body.password.length < 4){
    res.status(400).render('pages/register', {
      error: true,
      message: "Password is too short",
    });
  }
  else {
    db.any('SELECT * FROM users WHERE username = $1', [req.body.username])
    .then(async data => {
      if(data.length == 0) {
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
  res.json({status: 'success', message: 'Welcome!'});
});

db.any('SELECT COUNT(*) FROM movies')
  .then(data => {
    const count = data[0].count;
    if (count === '0') {
      fetchMovieData(); 
    } 
  })


module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
