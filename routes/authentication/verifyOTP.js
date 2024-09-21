const { email_schema, otp_schema } = require("../../schemas");
const client = require('../../config/database');
const router = require("express").Router();
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
    try {
        // req.body = {email, otp}
        const { email, otp } = req.body;
        if (!email) return res.status(400).json({ type: "email", message: "Please provide an email" });
        if (!otp) return res.status(400).json({ type: "otp", message: "Please provide an otp" });

        // validating data
        try { await email_schema.validateAsync(req.body); }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }
        try { await otp_schema.validateAsync(req.body); }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // database collections
        const otp_coll = client.db("LinkUp").collection("otp");
        const accounts_coll = client.db("LinkUp").collection("accounts");

        // checking if email already exist
        const otp_obj = await otp_coll.findOne({ email: email }, { projection: { _id: 0 } });
        if (!otp_obj) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        // checking if otp is expired
        if (new Date() > new Date(otp_obj.expires)) {
            return res.status(400).json({ type: "otp", message: "OTP Expired. Please Request New OTP" });
        }

        // checking if otp is correct
        if (otp_obj.otp_code != otp) {
            return res.status(400).json({ type: "otp", message: "Incorrect OTP. Please Enter Correct OTP" });
        }

        // verifying email if not verified
        const account_info = await accounts_coll.findOne({ email: email }, { projection: { _id: 0 } });
        if (!account_info) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }
        if (!account_info.verified) {
            await accounts_coll.updateOne({ email: email }, { $set: { verified: true } });
        }

        if (otp < 5000) {
            // generated otp from 1000 to 4999 are for verification
            const token = jwt.sign(
                { user_id: account_info.user_id },
                process.env.TOKEN_KEY
            );
            return res.status(200).send({ token });
        }
        else if (otp >= 5000 && otp < 10000) {
            // generated otp from 5000 to 9999 are for password reset
            const token = jwt.sign(
                { user_id: account_info.user_id },
                process.env.PASS_RESET_TOKEN_KEY,
                { expiresIn: "10m" }
            );
            return res.status(200).send({ token });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router