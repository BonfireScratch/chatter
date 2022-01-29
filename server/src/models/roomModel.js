const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { messageSchema } = require('./messageModel');
const { userSchema } = require('./userModel');

const roomSchema = new Schema({
  name: { type: String, unique: true },
  avatarLink: String,
  users: [userSchema],
  messages: [messageSchema],
  key: String,
});

let Room = mongoose.model('Room', roomSchema);

// TESTING PURPOSES
// Room.deleteMany({}).then(() => {
//   console.log("Data deleted");
// });

module.exports = Room;
