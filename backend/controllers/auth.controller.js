import User from '../models/user.models.js';
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from '../utils/generateToken.js';
import { getAuthCookieOptions } from '../utils/cookieOptions.js';

export const signup = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
        const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
        const gender = typeof req.body.gender === "string" ? req.body.gender : "";
        
        if (!fullName || !username || !password || !confirmPassword || !gender) {
            return res.status(400).json({error: "Missing required fields"});
        }

        if (password.length < 6) {
            return res.status(400).json({error: "Password must be at least 6 characters"});
        }

        if (password !== confirmPassword) {
            return res.status(400).json({error:"Passwords don't match"});
        }
        const user = await User.findOne({username});

        if (user) {
            return res.status(400).json({error: "username already exist"});
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
            res.status(400).json({error: "Invalid user data"});
        }
    
    } catch (error) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({error: "Internal server error"});
    }
};

////////////
export const login = async (req, res) => {
    try {
        const {username, password} = req.body;

        // Stop early when the request is incomplete to avoid unnecessary DB work.
        if (!username || !password) {
            return res.status(400).json({error: "Username and password are required"});
        }

        const user = await User.findOne({username});
        const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

        // Return immediately on failed auth so the success path never runs with invalid data.
        if (!user || !isPasswordCorrect) {
            return res.status(400).json({error: "Invalid username or password"});
        }

        generateTokenAndSetCookie(user._id, res);

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            //profilePic: newUser.profilePic,
        });

    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({error: "Internal server Error"});
    }
};

export const logout = async (req, res) => {
    //clear the jwt cookie by overwriting it with an empty value and expiring it immediately (maxAge: 0).
    try {
        res.cookie("jwt", "", {
            ...getAuthCookieOptions(0),
        });
        res.status(200).json({message: "Logged out successfully"});
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({error: "Internal server error"});
    }
};

export const getMe = async (req, res) => {
    try {
        // protectRoutes already checks the cookie and attaches the safe user object to the request.
        return res.status(200).json(req.user);
    } catch (error) {
        console.log("Error in getMe controller", error.message);
        return res.status(500).json({error: "Internal server error"});
    }
};
