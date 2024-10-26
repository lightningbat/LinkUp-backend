const joi = require("joi");

module.exports = joi.object({
    display_name: joi.string().pattern(/^[a-zA-Z0-9\s_-]*$/).required().min(1).max(20)
}).options({ stripUnknown: true })