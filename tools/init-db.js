require('dotenv').config();
const db = require('./db');

db.ensureSchema()
  .then(() => {
    console.log('Base de données prête.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Impossible de créer la base :', error.message);
    process.exit(1);
  });
