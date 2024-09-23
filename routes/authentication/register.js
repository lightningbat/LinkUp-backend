const userAccount_schema = require("../../schemas/userAccount_Schema");
const bcrypt = require("bcrypt");
const router = require("express").Router();
const client = require('../../config/database');
const crypto = require("crypto");
const bgColor_list = require('../../static/accounts_profile_bg_colors.json')

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

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");

        let account_info; // holds processed/sanitized user information
        try {
            account_info = await userAccount_schema.validateAsync(req.body);
        }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }) }

        // checking if email already exist
        if (await accounts_coll.findOne({ email: account_info.email })){ 
            return res.status(400).json({ 
                type: "email", 
                message: "Email Already Exist. Please Login" 
            });
        }

        // replacing password with hashed password
        account_info.password = await bcrypt.hash(account_info.password, 10);

        const random_id = crypto.randomBytes(16).toString("hex");
        const random_bgColor = bgColor_list[Math.floor(Math.random() * bgColor_list.length)];
        const username = await username_generator(account_info.display_name);

        //  adding date created field to the user account
        account_info = { ...account_info, username, user_id: random_id, profile_img: null, bgColor: random_bgColor, date_created: new Date().toUTCString(), verified: false };

        // saving user information and creating doc
        await accounts_coll.insertOne(account_info);

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