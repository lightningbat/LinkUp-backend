const router = require("express").Router();
const joi = require("joi");
const client = require("../../config/database");

router.post("/", async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).send("Please provide username");
        }
        try {
            await joi.string().alphanum().min(1).max(40).validateAsync(username);
        }
        catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }
        
        const accounts_coll = client.db("LinkUp").collection("accounts");
        
        const searched_user = await accounts_coll.findOne({ username: username }, 
            { projection: { _id: 0,
                user_id: 1,
                display_name: 1,
                profile_img: 1,
                bgColor: 1
            }
        });

        if (!searched_user) {
            return res.status(400).send("User does not exist");
        }

        if (searched_user.user_id === req.user.user_id) {
            return res.status(400).send("Lol, you can't add yourself");
        }

        // checking if user is already in contacts
        const current_user_contacts = await accounts_coll.findOne({ user_id: req.user.user_id }, 
            { projection: { _id: 0, chat_contacts: 1 } });
        
        if ("chat_contacts" in current_user_contacts) {
            if (searched_user.user_id in current_user_contacts.chat_contacts) {
                return res.status(400).send("User is already in your contact list");
            }
        }

        return res.status(200).json(searched_user);
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router