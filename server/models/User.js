const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const savedRouteSchema = new mongoose.Schema({
  origin: {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  destination: {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  mode: { type: String, default: 'driving' },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Don't return password by default in queries
    },
    savedRoutes: [savedRouteSchema],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

