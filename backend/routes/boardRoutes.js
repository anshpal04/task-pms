const express = require("express");
const {
  createBoard,
  getMyBoards,
  inviteMember,
} = require("../controllers/boardControllers");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, adminOnly, createBoard);
router.get("/", protect, getMyBoards);
router.put("/:id/invite", protect, adminOnly, inviteMember);

module.exports = router;
