const mongoose = require('mongoose');

const TrustedNetworkSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true, trim: true, index: true },
  label: { type: String, default: 'Trusted network', trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('TrustedNetwork', TrustedNetworkSchema);
