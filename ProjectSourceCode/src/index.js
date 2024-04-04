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

function fetchMovieData(movieTitle) {
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${movieTitle}`;


  // Fetch request
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response not ok');
      }

      return response.json();
    })
    .then(data => {
      console.log(data);
      // Handle data here
    })
    .catch(error => {
      console.error('Problem occurred with fetch: ', error);
    });
}

app.get('/', (req, res) => {
  fetchMovieData('The Matrix');
  res.redirect('/login');
})

app.get('/login', (req, res) => {
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
                  res.render('pages/home')
              }
              else {
                  res.render('pages/login', {
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

app.get('/register', (req, res) => {
  res.render('pages/register');
});

app.post('/register', async (req, res) => {
  db.any('SELECT * FROM users WHERE username = $1', [req.body.username])
  .then(async data => {
    if(data.length == 0) {
      const hash = await bcrypt.hash(req.body.password, 10);
  
      await db.any(`INSERT INTO users (username, password) VALUES ($1, $2);`,
      [req.body.username, hash]).then(data => {
        res.redirect('/login')
      })
      .catch(err => {
        res.redirect('/register')
      });   
    }
    else {
      res.render('pages/register', {
        error: true,
        message: "Username already exists",
      });
    }

  })
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
})



app.listen(3000);
console.log('Server is listening on port 3000');
