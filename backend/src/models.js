const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
});

const optionSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  correct:   { type: Boolean, default: false },
  votes:     { type: Number, default: 0 },
});

const pollSchema = new mongoose.Schema({
  teacherUsername: { type: String, required: true, index: true },
  question:        { type: String, required: true },
  options:         [optionSchema],
  timer:           { type: Number, default: 60 },
  createdAt:       { type: Date, default: Date.now, index: true },
});

const Teacher = mongoose.model("Teacher", teacherSchema);
const Poll    = mongoose.model("Poll",    pollSchema);

module.exports = { Teacher, Poll };
