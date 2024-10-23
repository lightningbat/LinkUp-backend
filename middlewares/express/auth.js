const jwt = require("jsonwebtoken");
const joi = require("joi");

const verifyToken = async (req, res, next) => {
    const token =
        req.body.token || req.query.token || req.headers["x-access-token"];
    if (!token) {
        return res.status(403).send("A token is required for authentication");
    }
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const { user_id } = decoded;
        
        const uuid_schema = joi.string().guid({ version: 'uuidv4' }).required();
        try { await uuid_schema.validateAsync(user_id); }
        catch (err) { return res.status(400).send(err.message); }

        req.user = decoded;
    } catch (err) {
        return res.status(401).send(err.message);
    }
    return next();
};

module.exports = verifyToken;
