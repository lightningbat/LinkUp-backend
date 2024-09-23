const joi = require("joi");

module.exports = joi.object({
    email: joi.string().email().required().max(40),
    password: joi.string().required().min(5).max(40),
    // regex for a-z A-Z 0-9 _ - and whitespace
    display_name: joi.string().pattern(/^[a-zA-Z0-9\s_-]*$/).required().min(1).max(20)
}).options({ stripUnknown: true })