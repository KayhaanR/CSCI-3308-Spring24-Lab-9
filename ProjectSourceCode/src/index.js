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

function fetchMovieData() {
  const fetch = require('node-fetch');

  var url = 'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1';
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
              db.any(`INSERT INTO movies (movie_id, image_path, name, year, description, genre, director, actors, language, awards, metacritic, imdb) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`, 
      [tmdbData.id, omdbData.Poster, omdbData.Title, omdbData.Year, omdbData.Plot, omdbData.Genre, omdbData.Director, omdbData.Actors, omdbData.Language, omdbData.Awards, omdbData.Metascore, omdbData.imdbRating])
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
  res.render('pages/home');
});

app.get('/flix', (req, res) => {
  res.render('pages/flix');
});

app.get('/forYou', (req, res) => {
  res.render('pages/forYou');
});

app.get('/profile', (req, res) => {
  res.render('pages/profile');
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

fetchMovieData();

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
