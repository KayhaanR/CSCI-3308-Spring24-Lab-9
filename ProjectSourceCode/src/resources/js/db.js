const pgp = require('pg-promise')();
const dbConfig = {
    host: 'db',
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

db.connect()
    .then(obj => {
      console.log('Predict Database connection successful');
      obj.done();
    })
    .catch(error => {
      console.log('ERROR:', error.message || error);
    });

module.exports = db;
