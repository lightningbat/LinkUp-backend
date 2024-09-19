const router = require("express").Router();
const password_schema = require("../schemas/password_schema");
const client = require('../config/database');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
    try {
        // req.body = {token, password}
        const { token, new_password } = req.body;
        if (!token) return res.status(400).json({ type: "token", message: "Please provide a token" });
        if (!new_password) return res.status(400).json({ type: "password", message: "Please provide new password" });

        req.body.password = req.body.new_password;

        // validating data
        try { await password_schema.validateAsync(req.body); }
        catch (err) { return res.status(400).json({ type: err.details[0].context.label, message: err.message }); }

        // verifying token without throwing an error
        try {
            jwt.verify(token, process.env.PASS_RESET_TOKEN_KEY);
        }
        catch (err) {
            return res.status(400).json({ type: "token", message: "Invalid Token. Please Request New Token" });
        }

        const email = jwt.verify(token, process.env.PASS_RESET_TOKEN_KEY).email;

        // database collection
        const accounts_coll = client.db("LinkUp").collection("accounts");

        // checking if email exist
        const account_obj = await accounts_coll.findOne({ email: email }, { projection: { _id: 0 } });
        if (!account_obj) {
            return res.status(400).json({ type: "email", message: "Email Does Not Exist. Please Register" });
        }

        // replacing password with hashed password
        account_obj.password = await bcrypt.hash(new_password, 10);
        await accounts_coll.updateOne({ email: email }, { $set: { password: account_obj.password } });

        res.status(200).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router