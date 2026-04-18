import express from "express";
//import { signup } from "../controllers/auth.controller.js";

import { signup, login, logout, getMe } from "../controllers/auth.controller.js";
import protectRoutes from "../middleWare/protectRoutes.js";

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.get("/me", protectRoutes, getMe);

export default router;
