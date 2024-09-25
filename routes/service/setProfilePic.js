const router = require("express").Router();
const joi = require("joi");
const client = require("../../config/database");

router.post("/", async (req, res) => {
    try{
        if (!req.body.image) return res.status(400).send("Please provide an image");
        try {
            await joi.string().dataUri().required().validateAsync(req.body.image);
        }
        catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }
        const userId = req.user.user_id;
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const result = await accounts_coll.updateOne({ user_id: userId }, { $set: { profile_img: req.body.image } });

        if (result.modifiedCount === 1) {
            return res.status(200).send();
        }
        res.status(400).send("Failed to set profile pic");
    }
    catch(err){
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router