// const { io } = require("../../config/webSocket")
const jwt = require("jsonwebtoken");
const joi = require("joi");

function verifyToken (socket, next) {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.TOKEN_KEY, function (err, decoded) {
            if (err) {
                return next(new Error("Invalid token"));
            }
            const uuid_schema = joi.string().guid({ version: 'uuidv4' }).required();
            try { uuid_schema.validateAsync(decoded.user_id); }
            catch (err) { return next(new Error(err.message)); }

            socket.user = decoded;
            next();
        });
    } else {
        next(new Error("Token not found"));
    }
}

module.exports = verifyToken