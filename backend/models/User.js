const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password_hash: { type: String, required: true },
    name: { type: String },
    phone: { type: String },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
      index: true,
    },
    is_demo: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    email_verification_required: {
      type: Boolean,
      default: true,
    },

    last_login_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
