const email_schema = require("../../schemas/email_schema");
const router = require("express").Router();

const client = require('../../config/database');

const OTP_Mailer = require("../../utils/otp_mailer");
const generateOTP = require("../../utils/opt_generator");

router.post("/", async (req, res) => {
    try {
        // req.body = {email}
        const { email } = req.body;
        if (!email) return res.status(400).json({ type: "email", message: "Please provide an email" });

        // validating data
        try { await email_schema.validateAsync(req.body); }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const unverified_accounts_coll = client.db("LinkUp").collection("unverified accounts");

        // checking if email already exist
        const from_verified = accounts_coll.countDocuments({ email: email });
        const from_unverified = unverified_accounts_coll.countDocuments({ email: email });

        const from_all = await Promise.all([from_verified, from_unverified]);
        
        if (!from_all[0] && !from_all[1]) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        const otp = generateOTP(type = "password_reset", email);
        OTP_Mailer(email, otp);

        res.status(200).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router