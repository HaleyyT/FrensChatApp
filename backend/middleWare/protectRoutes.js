import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import { createHttpError } from '../utils/httpError.js';

const protectRoutes = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            return next(createHttpError(401, "AUTH_REQUIRED", "Unauthorized access - No token provided"));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Keep the success path explicit so later edits still require a userId from the token payload.
        if (!decoded?.userId) {
            return next(createHttpError(401, "INVALID_TOKEN", "Unauthorized access - Invalid token"));
        }
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return next(createHttpError(401, "USER_NOT_FOUND", "Unauthorized access - User not found"));
        }

        // Attach the safe user object once so downstream controllers can trust the auth context.
        req.user = user;
        req.userId = decoded.userId;

        next();

    } catch (error) {
        next(createHttpError(401, "UNAUTHORIZED", "Unauthorized access"));
    }
};

export default protectRoutes;
