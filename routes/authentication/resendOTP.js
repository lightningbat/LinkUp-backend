const email_schema = require("../../schemas/email_schema");
const client = require('../../config/database');
const router = require("express").Router();
const generateOTP = require("../../utils/opt_generator");

const OTP_Mailer = require("../../utils/otp_mailer");

router.post("/", async (req, res) => {
    try {
        // req.body = {email}
        const { email } = req.body;
        if (!email) return res.status(400).json({ type: "email", message: "Please provide an email" });

        // validating data
        try { await email_schema.validateAsync(req.body); }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // database collection
        const otp_coll = client.db("LinkUp").collection("otp");

        /* Defensive Code */
        // checking if email already exist
        const old_otp = await otp_coll.findOne({ email: email }, { projection: { _id: 0, otp_code: 1 }});
        if (!old_otp) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        // generating new otp
        const new_otp_type = old_otp.otp_code < 5000 ? "registration" : "password_reset";
        const new_otp = generateOTP(type = new_otp_type, email);

        // emailing otp to the user
        OTP_Mailer(email, new_otp);

        res.status(200).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router