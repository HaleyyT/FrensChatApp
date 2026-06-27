import express from "express";
import { signup, login, logout, getMe } from "../controllers/auth.controller.js";
import protectRoutes from "../middleWare/protectRoutes.js";
import { validateRequest } from "../middleWare/validateRequest.js";
import { validateLoginBody, validateSignupBody } from "../validation/requestValidators.js";

const router = express.Router();

router.post("/signup", validateRequest({ body: validateSignupBody }), signup);

router.post("/login", validateRequest({ body: validateLoginBody }), login);

router.post("/logout", logout);

router.get("/me", protectRoutes, getMe);

export default router;
