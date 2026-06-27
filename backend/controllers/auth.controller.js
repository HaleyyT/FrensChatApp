import User from '../models/user.models.js';
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from '../utils/generateToken.js';
import { getAuthCookieOptions } from '../utils/cookieOptions.js';
import { createHttpError } from '../utils/httpError.js';

export const signup = async (req, res, next) => {
    try {
        const { password, fullName, username, gender } = req.body;
        const user = await User.findOne({username});

        if (user) {
            throw createHttpError(400, "USERNAME_TAKEN", "Username already exists");
        }
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // https://avatar-placeholder.iran.liara.run/
        // const boyProfilePic = 'https://avatar.iran.liara.run/public/boy?username=$(username)'
        // const girlProfilePic = 'https://avatar.iran.liara.run/public/girl?username=$(username)'
        
        const newUser = new User ({
            fullName,
            username,
            password:hashedPassword,
            gender,
            // profilePic: gender === "male" ? boyProfilePic : girlProfilePic
        })

        if (newUser) {
            await newUser.save();
            //Generate JWT token only after the account is persisted successfully.
            generateTokenAndSetCookie(newUser._id, res);
            
            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                username: newUser.username,
                //profilePic: newUser.profilePic,
            });

        } else {
            throw createHttpError(400, "INVALID_USER_DATA", "Invalid user data");
        }
    
    } catch (error) {
        next(error);
    }
};

////////////
export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({username});
        const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

        // Return immediately on failed auth so the success path never runs with invalid data.
        if (!user || !isPasswordCorrect) {
            throw createHttpError(400, "INVALID_CREDENTIALS", "Invalid username or password");
        }

        generateTokenAndSetCookie(user._id, res);

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            //profilePic: newUser.profilePic,
        });

    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    //clear the jwt cookie by overwriting it with an empty value and expiring it immediately (maxAge: 0).
    try {
        res.cookie("jwt", "", {
            ...getAuthCookieOptions(0),
        });
        res.status(200).json({message: "Logged out successfully"});
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        // protectRoutes already checks the cookie and attaches the safe user object to the request.
        return res.status(200).json(req.user);
    } catch (error) {
        next(error);
    }
};
