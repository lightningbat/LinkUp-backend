const userAccount_schema = require("../../schemas/userAccount_Schema");
const bcrypt = require("bcrypt");
const router = require("express").Router();
const client = require('../../config/database');
const bgColor_list = require('../../static/accounts_profile_bg_colors.json')
const base_user_settings = require('../../static/base_user_settings.json');

const OTP_Mailer = require("../../utils/otp_mailer");
const generateOTP = require("../../utils/opt_generator");
const username_generator = require("../../utils/user_name");

function ifAllDataExists(data) {
    if (!data.display_name) return {type: "display_name", message: "Please provide a username"}
    if (!data.email) return {type: "email", message: "Please provide an email"}
    if (!data.password) return {type: "password", message: "Please provide a password"}
    return true;
}

router.post("/", async (req, res) => {
    try {
        // req.body = {display_name, email, password}

        const allDataExists = ifAllDataExists(req.body);
        if (allDataExists !== true) return res.status(400).json(allDataExists);

        let account_info; // holds processed/sanitized user information
        try {
            account_info = await userAccount_schema.validateAsync(req.body);
        }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }) }

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const unverified_accounts_coll = client.db("LinkUp").collection("unverified accounts");

        const from_verified = accounts_coll.countDocuments({ email: account_info.email });
        const from_unverified = unverified_accounts_coll.countDocuments({ email: account_info.email });

        // checking if email already exist
        const from_all = await Promise.all([from_verified, from_unverified]);
        if (from_all[0] || from_all[1]) {
                return res.status(400).json({ 
                    type: "email", 
                    message: "Email Already Exist. Please Login" 
                });
        }

        // encrypting password
        account_info.password = await bcrypt.hash(account_info.password, 10);

        const data_to_insert = {
            display_name: account_info.display_name,
            email: account_info.email,
            password: account_info.password,
            joined_timestamp: new Date()
        }
        // adding user to database
        await unverified_accounts_coll.insertOne(data_to_insert);

        const otp = generateOTP(type = "registration", email = account_info.email);
        OTP_Mailer(email = account_info.email, otp);

        res.status(200).send();
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router