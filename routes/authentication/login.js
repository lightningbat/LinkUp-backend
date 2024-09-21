const userAccount_schema = require("../../schemas/userAccount_schema");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = require("express").Router();
const client = require('../../config/database');

const OTP_Mailer = require("../../utils/otp_mailer");
const generateOTP = require("../../utils/opt_generator");

function ifAllDataExists(data) {
    if (!data.email) return { type: "email", message: "Please provide an email" }
    if (!data.password) return { type: "password", message: "Please provide a password" }
    return true;
}

router.post("/", async (req, res) => {
    try {
        // req.body = {email, password}

        const allDataExists = ifAllDataExists(req.body);
        if (allDataExists !== true) return res.status(400).json(allDataExists);

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");

        // adding a temporary username as input-validator throws an error for blank field
        req.body.username = "abcdefgh"

        // validating data
        let account_info;
        try {
            account_info = await userAccount_schema.validateAsync(req.body);
        }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // finding the email that matches with the sanitized email
        const user = await accounts_coll.findOne({ email: account_info.email }, { projection: { _id: 0 } });

        if (!user) return res.status(400).json({ type: "email", message: "Email Not Found" });

        // matching password with hashed password from database
        const isMatch = await bcrypt.compare(account_info.password, user.password);

        if (!isMatch) return res.status(400).json({ type: "password", message: "Incorrect Password" });

        if (!user.verified) {
            const otp = generateOTP(type = "registration", email = account_info.email);
            OTP_Mailer(email = account_info.email, otp);
            return res.status(200).send({ verified: false })
        }

        const token = jwt.sign(
            { user_id: user.user_id },
            process.env.TOKEN_KEY
        );

        res.status(200).send({ token, verified: true });

    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router
