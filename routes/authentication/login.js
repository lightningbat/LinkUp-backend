const userAccount_schema = require("../../schemas/userAccount_Schema");
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

        // adding a temporary display_name as input-validator throws an error for blank field
        req.body.display_name = "abcdefgh"

        // validating data
        let account_info;
        try {
            account_info = await userAccount_schema.validateAsync(req.body);
        }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const unverified_accounts_coll = client.db("LinkUp").collection("unverified accounts");

        // getting user from database
        const from_verified = accounts_coll.findOne({ email: account_info.email }, { projection: { _id: 0, user_id: 1, socket_room_id: 1, password: 1 } });
        const from_unverified = unverified_accounts_coll.findOne({ email: account_info.email }, { projection: { _id: 0, password: 1 } });

        const user = await Promise.all([from_verified, from_unverified]);
        // email not found in both collections
        if (!user[0] && !user[1]) return res.status(400).json({ type: "email", message: "Email Not Found" });

        const isVerified = user[0] ? true : false;
        const password_from_database = isVerified ? user[0].password : user[1].password;

        // matching password with hashed password from database
        const isMatch = await bcrypt.compare(account_info.password, password_from_database);

        if (!isMatch) return res.status(400).json({ type: "password", message: "Incorrect Password" });

        if (!isVerified) {
            const otp = generateOTP(type = "registration", email = account_info.email);
            OTP_Mailer(email = account_info.email, otp);
            return res.status(200).send({ verified: false })
        }

        const token = jwt.sign(
            { user_id: user[0].user_id, socket_room_id: user[0].socket_room_id },
            process.env.TOKEN_KEY
        );

        res.status(200).send({ token, verified: true });

    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router
