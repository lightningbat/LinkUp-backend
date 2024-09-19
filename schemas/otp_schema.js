const joi = require("joi");

module.exports = joi.object({
    otp: joi.number().required().min(1000).max(9999)
}).options({ stripUnknown: true })