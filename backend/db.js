const mongoose = require('mongoose');

function connectDB(uri) {
  return mongoose.connect(uri);
}

module.exports = connectDB;
