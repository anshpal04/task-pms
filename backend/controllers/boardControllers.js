const Board = require("../models/Board");

const createBoard = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const board = await Board.create({
      title,
      owner: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyBoards = async (req, res) => {
  try {
    const boards = await Board.find({ members: req.user._id }).populate(
      "owner",
      "name email",
    );

    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const inviteMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the board owner can invite members" });
    }

    if (board.members.includes(userId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    board.members.push(userId);
    await board.save();

    res.json({ message: "Member added", board });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createBoard, getMyBoards, inviteMember };
