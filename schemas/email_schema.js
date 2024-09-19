const joi = require("joi");

module.exports = joi.object({
    email: joi.string().email().required().min(5).max(40)
}).options({ stripUnknown: true })