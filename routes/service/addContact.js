const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");

router.post("/", async (req, res) => {
    try {
        const { contact_user_id } = req.body;
        const { user_id } = req.user;

        if (!contact_user_id) {
            return res.status(400).send("Please provide user_id to add");
        }
        try {
            await joi.string().min(1).max(200).validateAsync(contact_user_id);
        }
        catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }

        if (contact_user_id === user_id) {
            return res.status(400).send("Cannot add yourself");
        }

        const accounts_coll = client.db("LinkUp").collection("accounts");

        // checking if user is already in contacts
        const current_user_contacts = await accounts_coll.findOne({ user_id }, { projection: { _id: 0, chat_contacts: 1 } });
        if ("chat_contacts" in current_user_contacts) {
            if (contact_user_id in current_user_contacts.chat_contacts) {
                return res.status(400).send("Already in contacts");
            }
        }
        
        const result = await accounts_coll.updateOne({ user_id }, 
            {$set: {[`chat_contacts.${contact_user_id}`]: { chat_id : null, blocked: false }}});

        if (result.modifiedCount === 1) {
            return res.status(200).send();
        }
        res.status(400).send("Failed to add contact");
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router