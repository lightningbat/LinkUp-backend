const joi = require("joi");

module.exports = joi.object({
    email: joi.string().email().required().min(5).max(40),
    password: joi.string().required().min(5).max(40),
    username: joi.string().required().min(3).max(20)
}).options({ stripUnknown: true })