import jwt, { decode } from 'jsonwebtoken';
import User from '../models/user.models.js';

const protectRoutes = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            return res.status(401).json({ error: "Unauthorised access - No token provided" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decode) {
            return res.status(401).json({ error: "Unauthorised access - Invalid token" });
        }
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ error: "Unauthorised access - User not found" });
        }

        // Attach user to request object 
        req.user = user;
        req.userId = decoded.userId;

        // call next middleware which call sendMessage controller
        next();

    } catch (error) {
        console.log("Error in protectRoutes middleware", error.message);
        res.status(401).json({ error: "Unauthorized access" });
    }
};

export default protectRoutes;