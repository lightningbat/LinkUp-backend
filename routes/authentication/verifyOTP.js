const { email_schema, otp_schema } = require("../../schemas");
const client = require('../../config/database');
const router = require("express").Router();
const jwt = require("jsonwebtoken");

const accountsCollectionPopulator = require("../../utils/accountsCollectionPopulator");
const { status } = require("express/lib/response");

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

        const from_unverified_coll = unverified_accounts_coll.findOne({ email: email }, { projection: { _id: 0 } });
        const from_verified_coll = accounts_coll.findOne({ email: email }, { projection: { _id: 0, user_id: 1 } });
        const [account_info_from_unverified, account_info_from_verified] = await Promise.all([from_unverified_coll, from_verified_coll]);
        const account_info = account_info_from_unverified || account_info_from_verified;
        const is_account_verified = account_info_from_unverified ? false : true;

        if (!account_info) return res.status(400).json({ type: "email", message: "Account Does Not Exist. Please Register" });

        // otp ranging between 1000 and 4999 are for account registration
        if (otp_obj.otp_code < 5000) {

            if (is_account_verified) {
                return res.status(400).json({ type: "email", message: "Account Already Verified. Please Login" });
            }

            const verify_account = await verifyAccount(account_info);

            if (verify_account.status !== 200) {
                return res.status(400).json({ type: verify_account.type, message: verify_account.message });
            }

            const user_id = verify_account.user_id;
            const token = jwt.sign(
                { user_id: user_id, socket_room_id: verify_account.socket_room_id },
                process.env.TOKEN_KEY
            );
            return res.status(200).send({ token });
        }
        // otp ranging between 5000 and 9999 are for password reset
        else if (otp_obj.otp_code >= 5000 && otp_obj.otp_code < 10000) {

            let user_id = account_info.user_id;

            if (!is_account_verified) {
                const verify_account = await verifyAccount(account_info);

                user_id = verify_account.user_id;

                if (verify_account.status !== 200) {
                    return res.status(400).json({ type: verify_account.type, message: verify_account.message });
                }
            }

            // generating password reset token
            const token = jwt.sign(
                { user_id: user_id },
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
    // checking if otp matches
    if (otp_obj.otp_code != otp) {
        return { type: "otp", message: "Incorrect OTP. Please Enter Correct OTP" };
    }
    // checking if otp is expired
    if (new Date() > new Date(otp_obj.expires)) {
        return { type: "otp", message: "OTP Expired. Please Request New OTP" };
    }

    return { type: "success", message: "OTP Verified" };
}

/**
 * 
 * @description transfer account data from unverified accounts collection to verified accounts collection
 * @param {obj} account_info - account data from unverified accounts collection
 * @returns {Promise<{type: string, status: number, message: string, user_id: string, socket_room_id: string}>}
 */
async function verifyAccount(account_info) {
    // adding account data to verified accounts collection
    const verify_account = await accountsCollectionPopulator(account_info);

    // deleting account data from unverified accounts collection
    client.db("LinkUp").collection("unverified accounts").deleteOne({ email: account_info.email });

    return verify_account;
}

module.exports = router