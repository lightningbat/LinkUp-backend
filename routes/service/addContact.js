const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");
const { getInActiveSocketIds } = require("../../config/webSocket");

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
        const current_user_contacts = await accounts_coll.findOne({ user_id }, 
            { projection: { _id: 0, chat_contacts: 1 } });

        if ("chat_contacts" in current_user_contacts) {
            if (contact_user_id in current_user_contacts.chat_contacts) {
                return res.status(400).send("Already in contacts");
            }
        }

        // getting contact's user data
        const user_to_add = await accounts_coll.findOne({ user_id: contact_user_id }, 
            { projection: { _id: 0,
                last_seen: 1,
                socket_ids: 1,
                settings: { last_seen_and_online: 1 }
            } });

        // checking if user exists
        if (!user_to_add) {
            return res.status(400).send("User does not exist");
        }

        // adding contact to the current user's contacts list
        const current_time = new Date();
        const result = await accounts_coll.updateOne({ user_id }, 
            {$set: {[`chat_contacts.${contact_user_id}`]: { chat_id : null, blocked: false, time: current_time }}});

        // holds last seen and online status of the contact
        const user_status = await getLastSeenAndOnline(contact_user_id, user_to_add.settings, user_to_add.socket_ids, user_to_add.last_seen);
        const res_to_send = {
            time: current_time,
            ...user_status
        }

        if (result.modifiedCount === 1) {
            return res.status(200).json({ ...res_to_send });
        }
        res.status(400).send("Failed to add contact");
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

async function getLastSeenAndOnline(user_id, settings, socket_ids = [], last_seen = null) {
    const result = {}
    // checking if user data holds any inactive socket ids
    const inActiveSocketIds = await getInActiveSocketIds(socket_ids);
    // removing inactive socket ids
    if (inActiveSocketIds.length) {
        // from the database
        client.db("LinkUp").collection("accounts").updateOne(
            { user_id: user_id }, { $pull: { socket_ids: { $in: [...inActiveSocketIds] } } });
        // from the fetched data
        socket_ids = socket_ids.filter((socket_id) => !inActiveSocketIds.includes(socket_id));
    }

    // setting last seen and online according to user's settings
    // if user has disabled last seen and online
    if (!settings.last_seen_and_online ) {
        result.online = false;
        result.last_seen = null;
    }
    // if not disabled
    // checking if contact is online
    else {
        // if user is online
        if ( socket_ids?.length ) {
            result.online = true;
            result.last_seen = null;
        }
        // if user is offline
        else {
            result.online = false;
            result.last_seen = last_seen;
        }
    }

    return result
}

module.exports = router