const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const { tokenBlackListModel } = require("../models/blacklist.model");

const authMiddleware = async (req, res, next) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        return res.status(401).json({
            message: "Authorization token required or invalid format"
        });
    }

    const isblacklisted = await tokenBlackListModel.findOne({ token });

    if (isblacklisted) {
        return res.status(400).json({
            message: "Unauthorized access , token in not valid "
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                message: "User no longer exists"
            });
        }

        req.user = user;
        next();


    } catch {
        return res.status(401).json({

            message: "invalid or expired token"

        });
    }

}

const systemUserAuthMiddleware = async (req, res, next) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        return res.status(401).json({
            message: "Authorization token required or invalid format"
        });
    }

    const isblacklisted = await tokenBlackListModel.findOne({ token });

    if (isblacklisted) {
        return res.status(400).json({
            message: "Unauthorized access , token in not valid "
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId).select("+systemUser");

        if (!user) {
            return res.status(401).json({
                message: "User no longer exists"
            });
        }

        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access , not a system user "
            });
        }

        req.user = user;
        next();


    } catch (err) {
        console.log("systemUserAuthMiddleware error =>", err.name, ":", err.message);
        return res.status(401).json({

            message: "invalid or expired token"

        });
    }

}

module.exports = { authMiddleware, systemUserAuthMiddleware };