const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");

router.post("/", async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { contacts } = req.body; // list of contact uuids

        // validating payload
        if (!contacts) return res.status(400).send("Please provide contacts list");
        if (!Array.isArray(contacts)) return res.status(400).send("Invalid contacts list format");
        if (contacts.length === 0) return res.status(400).send("Empty contacts list");

        // validating contact's uuids
        try{
            await joi.array().items(joi.string().guid({ version: 'uuidv4' })).validateAsync(contacts);
        } catch (err) {
            return res.status(400).send(err.message);
        }


        const accounts_coll = client.db("LinkUp").collection("accounts");
        const response = await accounts_coll.find({ user_id: { $in: contacts } }, 
            { projection: { _id: 0,
                user_id: 1,
                settings: { last_seen_and_online: 1 },
                socket_ids: 1,
                last_seen: 1
            } }).toArray();

        if (!response || response.length === 0) {
            return res.status(400).send("Failed to get online status");
        }

        // constructing response
        const contacts_online_status = {}; // { "uuid of the contact": { online: boolean, last_seen: Date }, ... }
        for (const contact of response) {
            const contact_data = { online: false, last_seen: null };

            if (contact.settings.last_seen_and_online) { // if user has enabled last seen and online

                if (contact?.socket_ids?.length) { // if user is online
                    contact_data.online = true;
                }
                else { // if user is offline
                    contact_data.online = false;
                    contact_data.last_seen = contact?.last_seen || null;
                }
            }

            contacts_online_status[contact.user_id] = contact_data;
        }

        return res.status(200).json(contacts_online_status);
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router