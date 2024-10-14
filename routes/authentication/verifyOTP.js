const { email_schema, otp_schema } = require("../../schemas");
const client = require('../../config/database');
const router = require("express").Router();
const jwt = require("jsonwebtoken");

const accountsCollectionPopulator = require("../../utils/accountsCollectionPopulator");

router.post("/", async (req, res) => {
    try {
        // req.body = {email, otp}
        const { email, otp } = req.body;
        if (!email) return res.status(400).json({ type: "email", message: "Please provide an email" });
        if (!otp) return res.status(400).json({ type: "otp", message: "Please provide an otp" });

        // validating data
        try {
            const email_validation = email_schema.validateAsync(req.body);
            const otp_validation = otp_schema.validateAsync(req.body);
            await Promise.all([email_validation, otp_validation]);
        } catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }

        // database collections
        const otp_coll = client.db("LinkUp").collection("otp");
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const unverified_accounts_coll = client.db("LinkUp").collection("unverified accounts");

        // checking if otp associated with the email exists
        const otp_obj = await otp_coll.findOne({ email: email }, { projection: { _id: 0 } });
        if (!otp_obj) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        const otp_verification = verifyOTP(otp_obj, otp);
        if (otp_verification.type === "otp") {
            return res.status(400).json(otp_verification);
        }

        // otp ranging between 1000 and 4999 are for account registration
        if (otp_obj.otp_code < 5000) 
        {
            // getting account data from unverified accounts collection
            const account_info = await unverified_accounts_coll.findOne({ email: email }, { projection: { _id: 0 } });
            if (!account_info) {
                return res.status(400).json({ type: "email", message: "Account Does Not Exist. Please Register" });
            }
            // adding account data to verified accounts collection
            const add_to_verified_accounts = await accountsCollectionPopulator(account_info);
            // some error occurred while adding account data to verified accounts
            if (add_to_verified_accounts.status !== 200) {
                return res.status(add_to_verified_accounts.status).json(
                    { type:add_to_verified_accounts.type, message: add_to_verified_accounts.message }
                );
            }

            // deleting account data from unverified accounts collection
            unverified_accounts_coll.deleteOne({ email: email });

            const user_id = add_to_verified_accounts.user_id;
            const token = jwt.sign(
                { user_id: user_id },
                process.env.TOKEN_KEY
            );
            return res.status(200).send({ token });
        }
        // otp ranging between 5000 and 9999 are for password reset
        else if (otp_obj.otp_code >= 5000 && otp_obj.otp_code < 10000) {

            /* Defensive code */
            // checking if account exists
            const account_info = await accounts_coll.findOne({ email: email }, { projection: { _id: 0, user_id: 1 } });
            if (!account_info) {
                return res.status(400).json({ type: "email", message: "Account Does Not Exist. Please Register" });
            }
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


function verifyOTP(otp_obj, otp) {
    // checking if otp is expired
    if (new Date() > new Date(otp_obj.expires)) {
        return { type: "otp", message: "OTP Expired. Please Request New OTP" };
    }

    // checking if otp matches
    if (otp_obj.otp_code != otp) {
        return { type: "otp", message: "Incorrect OTP. Please Enter Correct OTP" };
    }

    return { type: "success", message: "OTP Verified" };
}

module.exports = router