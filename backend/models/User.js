const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  name: { type: String },
  phone: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
