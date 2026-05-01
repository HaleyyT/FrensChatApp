import jwt from 'jsonwebtoken'
import { getAuthCookieOptions } from './cookieOptions.js';

export const generateToken = (userId) => {
    return jwt.sign({userId}, process.env.JWT_SECRET, {
        expiresIn: '15d'
    });
};

const generateTokenAndSetCookie = (userId, res) => {
    const token = generateToken(userId);
    // Keep login/signup cookies consistent with logout, especially for cross-site deployed frontends.
    res.cookie("jwt", token, getAuthCookieOptions(15 * 24 * 60 * 60 * 1000));
    return token;
};

export default generateTokenAndSetCookie;
