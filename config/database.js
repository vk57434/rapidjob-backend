const { db, rtdb } = require('./firebaseAdmin');

module.exports = {
  firestore: db,
  realtime: rtdb
};
