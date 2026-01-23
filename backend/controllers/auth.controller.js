import User from '../models/user.models.js';

export const signup = async (req, res) => {
    try {
        const {fullName, password, confirmPassword, gender} = req.body;
        
        if (password != confirmPassword) {
            return res.status(400).json({error:"Passwords don't match"})
        }
        const user = await User.findOne({username});

        if (user) {
            return res.status(400).json({error: "username already exist"})
        }
        
    } catch (error) {}

    res.send("signupUser");
    console.log("signupUser");
};

export const login = (req, res) => {
    res.send("loginUser");
    console.log("loginUser");
};

export const logout = (req, res) => {
    res.send("logoutUser");
    console.log("logoutUser");
};