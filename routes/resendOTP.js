const email_schema = require("../schemas/email_schema");
const client = require('../config/database');
const router = require("express").Router();

const OTP_Mailer = require("../utils/otp_mailer");

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

        // checking if email already exist
        const otp_obj = await otp_coll.findOne({ email: email }, { projection: { _id: 0 } });
        if (!otp_obj) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        // updating time of old otp to current time
        const current_time = new Date();
        const new_date_created = current_time.toUTCString();
        const new_expires = new Date(current_time.setMinutes(new Date().getMinutes() + 3)).toUTCString();
        await otp_coll.updateOne({ email: email }, { $set: { date_created: new_date_created, expires: new_expires } });

        // sending otp to the user
        OTP_Mailer(otp_obj.email, otp_obj.otp_code);

        res.status(200).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router