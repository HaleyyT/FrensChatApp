import User from "../models/user.models.js";

export const getUsersForSidebar = async (req, res) => {
    try {

        const loggedInUserId = req.user._id;
        const filterUsers = await User.find({ _id: { $ne: loggedInUserId }}).select("-password");

        res.status(200).json({filterUsers });
    } catch (error) {
        console.error("Error for getUsersForSidebar", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}