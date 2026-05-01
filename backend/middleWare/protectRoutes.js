import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';

function getBearerToken(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== "string") {
        return "";
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
        return "";
    }

    return token;
}

const protectRoutes = async (req, res, next) => {
    try {
        const token = getBearerToken(req) || req.cookies.jwt;
        if (!token) {
            return res.status(401).json({ error: "Unauthorised access - No token provided" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Keep the success path explicit so later edits still require a userId from the token payload.
        if (!decoded?.userId) {
            return res.status(401).json({ error: "Unauthorised access - Invalid token" });
        }
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ error: "Unauthorised access - User not found" });
        }

        // Attach the safe user object once so downstream controllers can trust the auth context.
        req.user = user;
        req.userId = decoded.userId;

        next();

    } catch (error) {
        console.log("Error in protectRoutes middleware", error.message);
        res.status(401).json({ error: "Unauthorized access" });
    }
};

export default protectRoutes;
