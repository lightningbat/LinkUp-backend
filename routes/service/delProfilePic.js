const router = require("express").Router();
const joi = require("joi");
const client = require("../../config/database");

router.post("/", async (req, res) => {
    try{
        const userId = req.user.user_id;
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const result = await accounts_coll.updateOne({ user_id: userId }, { $set: { profile_img: null } });
        if (result.modifiedCount === 1) {
            return res.status(200).send();
        }
        res.status(400).send("Failed to delete profile pic");
    }
    catch(err){
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router