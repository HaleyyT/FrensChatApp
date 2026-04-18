import express from "express";
import { getMessages, sendMessage } from "../controllers/message.controller.js"
import protectRoutes from "../middleWare/protectRoutes.js";

const router = express.Router();

router.post("/send/:id", protectRoutes, sendMessage);
router.get("/:id", protectRoutes, getMessages);

export default router;
