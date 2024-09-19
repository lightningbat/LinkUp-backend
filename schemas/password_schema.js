const joi = require("joi");

module.exports = joi.object({
    password: joi.string().required().min(5).max(40)
}).options({ stripUnknown: true })