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
      db.any(`INSERT INTO movies (name, year, description, genre, director, actors, language, awards, metacritic, imdb) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, 
      [data.Title, data.Year, data.Plot, data.Genre, data.Director, data.Actors, data.Language, data.Awards, data.Metascore, data.imdbRating])
      .then(data => {
        console.log(data)
      })

    })
    .catch(error => {
      console.error('Problem occurred with fetch: ', error);
    });
}

app.get('/', (req, res) => {
  console.log(fetchMovieData('Barbie'));
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

app.get('/home', (req, res) => {
  res.render('pages/home');
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
    cb(null, '/uploads/'); // Specify the destination directory
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname); // Specify the filename
  }
});

// Initialize multer with the specified storage
const upload = multer({ storage: storage });

// Profile route with multer middleware
app.post('/profile', upload.single('profileImage'), async (req, res) => {
  // Multer saves the file in req.file
  if (req.file) {
    try {
      const username = req.session.user; // Assuming you're using sessions for authentication
      const profilePicturePath = req.file.filename;

      // Update the user's profile picture path in the database
      await db.one('UPDATE users SET profile_picture = $1 WHERE username = $2 returning *', [profilePicturePath, username]);

      console.log('Profile picture path updated in the database.');

      // Delete previous profile picture if not default
      const defaultPicture = '/personicon.jpg';
      const previousProfilePicture = await db.oneOrNone('SELECT profile_picture FROM users WHERE username = $1', [username]);
      if (previousProfilePicture && previousProfilePicture.profile_picture !== defaultPicture) {
        const filePath = path.join('/uploads/', previousProfilePicture.profile_picture);
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
