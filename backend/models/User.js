const mongoose = require("mongoose");
const bcrypt = require(`bcryptjs`);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: [6, "password must be at least 6 characters"],
      select: false, //never return pass in queries by default
    },
    role: {
      type: String,
      enum: ["user", "admin"], //only these two values allowed
      defualt: "user",
    },
  },
  {
    timestamps: true, // auto creates createdAt and updatedAt fields
  },
);
// --------middleware(runs before .save)-------
//this runs everytime we save a user
// we only want to hash if the pass was actually changed

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); //skip if the pass is not changed
  // gensalt(12) means 2^12 hashing rounds
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  next(); //continue saving
});

//-----instance methods-----
// methods we can call on any user object
//
// compare a plain text pass with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.cleanExpiredTokens = function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((t) => t.expiresAt > now);
};
module.exports = mongoose.model("User", userSchema);
