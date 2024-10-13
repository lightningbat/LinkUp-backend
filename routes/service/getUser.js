const router = require("express").Router();
const client = require("../../config/database");

router.post("/", async (req, res) => {
    try {
        const userId = req.user.user_id;
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const result = await accounts_coll.findOne({ user_id: userId }, 
            { projection: { 
            _id: 0,
            display_name: 1,
            username: 1,
            profile_img: 1,
            email: 1,
            bgColor: 1,
            verified: 1,
            settings: 1,
            chat_contacts: 1
            } 
        });
        if (!result) {
            return res.status(400).send("Failed to get user");
        }
        if (!result.verified) {
            return res.status(400).send("Account is not verified");
        }
        return res.status(200).json(result);
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router