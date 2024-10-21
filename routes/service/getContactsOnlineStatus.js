const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");
const { getInActiveSocketIds } = require("../../config/webSocket");

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

        // putting all contact's socket ids to an array
        const all_socket_ids = (response.map((contact) => contact?.socket_ids)).flat();
        // getting list of socket ids that are no longer active
        const inActiveSocketIds = await getInActiveSocketIds(all_socket_ids);

        // constructing response
        const contacts_online_status = {}; // { "uuid of the contact": { online: boolean, last_seen: Date }, ... }
        for (const contact of response) {
            const contact_data = { online: false, last_seen: null };

            // inactive socket ids of the current contact
            const inactive_socket_ids = []

            // removing inactive socket ids from fetched data
            contact.socket_ids = contact.socket_ids.filter((socket_id) => {
                if (inActiveSocketIds.includes(socket_id)) {
                    inactive_socket_ids.push(socket_id);
                    return false;
                }
                return true;
            })

            // removing inactive socket ids from the database
            if (inactive_socket_ids.length) {
                accounts_coll.updateOne({ user_id: contact.user_id }, 
                    { $pull: { socket_ids: { $in: [...inactive_socket_ids] } } });
            }

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