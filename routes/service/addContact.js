const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");
const { getInActiveSocketIds } = require("../../config/webSocket");

const { io } = require("../../config/webSocket")

router.post("/", async (req, res) => {
    try {
        const { contact_user_id } = req.body;
        const { user_id } = req.user;

        if (!contact_user_id) {
            return res.status(400).send("Missing contact's user ID");
        }
        try {
            await joi.string().guid({ version: 'uuidv4' }).required().validateAsync(contact_user_id);
        }
        catch (err) {
            return res.status(400).send(err.message);
        }

        if (contact_user_id === user_id) {
            return res.status(400).send("Cannot add yourself");
        }

        const accounts_coll = client.db("LinkUp").collection("accounts");

        // checking if user is already in contacts
        const current_user_info = await accounts_coll.findOne({ user_id }, 
            { projection: { _id: 0, chat_contacts: 1, socket_ids: 1, socket_room_id: 1 } });

        if ("chat_contacts" in current_user_info) {
            if (contact_user_id in current_user_info.chat_contacts) {
                return res.status(400).send("Already in contacts");
            }
        }

        // checking if user has multiple sockets connected
        let multiple_sockets = current_user_info.socket_ids.length > 1;

        // fields to get from database
        const projection = { _id: 0,
            last_seen: 1,
            socket_ids: 1,
            settings: { last_seen_and_online: 1 },
        }

        // if user has multiple sockets
        // getting more details to send to all other user's sockets
        if (multiple_sockets) {
            projection.display_name = 1;
            projection.profile_img = 1;
            projection.bgColor = 1;
            projection.username = 1;
        }

        // getting contact's user data
        const user_to_add = await accounts_coll.findOne({ user_id: contact_user_id }, 
            { projection: projection });

        // Defensive code
        // checking if user exists
        if (!user_to_add) {
            return res.status(400).send("User does not exist");
        }

        // adding contact to the current user's contacts list
        const current_time = new Date();
        const result = await accounts_coll.updateOne({ user_id }, 
            {$set: {[`chat_contacts.${contact_user_id}`]: { chat_id : null, blocked: false, timestamp: current_time }}});

        // holds last seen and online status of the contact
        const user_status = await getLastSeenAndOnline(contact_user_id, user_to_add.settings, user_to_add.socket_ids, user_to_add.last_seen);
        const res_to_send = {
            timestamp: current_time,
            ...user_status
        }

        if (result.modifiedCount === 1) {
            res.status(200).json({ ...res_to_send });

            // informing other user's sockets that a new contact has been added
            // if user has multiple sockets connected
            if (multiple_sockets) {
                // adding more details to send to all other user's sockets
                // since the socket which added the contact has already received the details
                res_to_send.display_name = user_to_add.display_name;
                res_to_send.profile_img = user_to_add.profile_img;
                res_to_send.bgColor = user_to_add.bgColor;
                res_to_send.user_id = contact_user_id;
                res_to_send.username = user_to_add.username;

                // informing other user's sockets
                current_user_info.socket_ids.forEach(socket_id => {
                    if (socket_id != req.body.socket_id) { // skipping the socket which added the contact
                        io.to(socket_id).emit("newContact", res_to_send);
                    }

                })
            }
        }
        else {
            return res.status(400).send("Failed to add contact");
        }
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