import express from "express";
import { getMessages, markMessagesAsRead, sendMessage } from "../controllers/message.controller.js"
import protectRoutes from "../middleWare/protectRoutes.js";
import { validateRequest } from "../middleWare/validateRequest.js";
import { validateMessageBody, validateMessageQuery, validateUserIdParams } from "../validation/requestValidators.js";

const router = express.Router();

router.post(
  "/send/:id",
  protectRoutes,
  validateRequest({ params: validateUserIdParams, body: validateMessageBody }),
  sendMessage
);
router.patch(
  "/read/:id",
  protectRoutes,
  validateRequest({ params: validateUserIdParams }),
  markMessagesAsRead
);
router.get(
  "/:id",
  protectRoutes,
  validateRequest({ params: validateUserIdParams, query: validateMessageQuery }),
  getMessages
);

export default router;
