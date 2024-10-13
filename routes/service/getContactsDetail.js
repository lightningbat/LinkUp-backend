const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");
const { getInActiveSocketIds } = require("../../config/webSocket");

const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
    try {
        // contact list: { "uuid of the contact": { chat_id: "uuid chat_id" } }
        const { contactsList } = req.body;
        if (contactsList == null || contactsList == undefined) return res.status(400).send("Please provide contacts list");
        if (typeof contactsList !== "object" || Array.isArray(contactsList)) {
            return res.status(400).send("Invalid contacts list format");
        }
        if ((Object.keys(contactsList).length === 0)) {
            return res.status(400).send("Empty contacts list");
        }

        const { user_id } = req.user;
        // removing current user from contacts list (if present)
        if (Object.keys(contactsList).includes(user_id)) {
            delete contactsList[user_id];
        }

        // all contact ids in contactsList
        let contact_ids;
        // all chat ids in contactsList
        const chat_ids = []

        // validating requested payload
        try {
            contact_ids = Object.keys(contactsList);

            for (let i = 0; i < contact_ids.length; i++) {
                const chat_id = contactsList[contact_ids[i]]?.chat_id;
                if (chat_id) {
                    chat_ids.push(chat_id);
                }
            }
            
            const p1 = joi.array().items(joi.string().guid({ version: 'uuidv4' })).validateAsync(contact_ids);
            const p2 = chat_ids.length > 0 && joi.array().items(joi.string().guid({ version: 'uuidv4' })).validateAsync(chat_ids);
            await Promise.all([p1, p2]);
        }
        catch (err) {
            return res.status(400).send(err.message);
        }

        const accounts_coll = client.db("LinkUp").collection("accounts");
        let all_contacts_info = await accounts_coll.find(
            { user_id: { $in: contact_ids } }, 
            { projection: { _id: 0,
                user_id: 1,
                display_name: 1,
                username: 1,
                profile_img: 1,
                bgColor: 1,
                last_seen: 1,
                settings: { last_seen_and_online: 1 },
                socket_ids: 1
            }
        }).toArray();

        if (!all_contacts_info || all_contacts_info.length === 0) {
            return res.status(400).send("Failed to get contacts");
        }

        let all_chats_info;
        if (chat_ids.length) 
        {
            const chat_coll = client.db("LinkUp").collection("chats");
            all_chats_info = await chat_coll.find(
                { _id: { $in: chat_ids } }, 
                { projection: { _id: 0,
                    chat_id: 1,
                    // members: 1,
                    user_1: 1,
                    user_2: 1,
                    user_1_unread_count: 1,
                    user_2_unread_count: 1,
                    user_1_last_updated: 1,
                    user_2_last_updated: 1
                } 
            }).toArray();
        }

        // putting all contact's socket ids to an array
        const all_socket_ids = (all_contacts_info.map((contact) => contact.socket_ids)).flat();
        // getting list of socket ids that are no longer active
        const inActiveSocketIds = await getInActiveSocketIds(all_socket_ids);

        const polished_contacts_info = all_contacts_info.map((contact) => {
            // removing inactive socket ids from contact's socket_ids
            if ("socket_ids" in contact && inActiveSocketIds.length) {
                // creating an array of inactive socket ids of the current contact
                // to remove all inactive socket ids from database all at once
                // instead of removing each socket id one by one
                const contact_inactive_socket_ids = [];

                // removing inactive socket ids
                contact.socket_ids = contact.socket_ids.filter((socket_id) => {
                    if (inActiveSocketIds.includes(socket_id)) {
                        contact_inactive_socket_ids.push(socket_id);
                        return false;
                    }
                    return true;
                })

                // removing inactive socket ids from the database
                if (contact_inactive_socket_ids.length) {
                    accounts_coll.updateOne({ user_id: contact.user_id }, 
                        { $pull: { socket_ids: { $in: [...contact_inactive_socket_ids] } } });
                }
            }

            // removing last seen and online from contact info
            // if user has disabled last seen and online
            if (!contact.settings.last_seen_and_online ) {
                contact.last_seen= null;
                contact.online = false;
            }
            // if not disabled
            // checking if contact is online
            else {
                if ( contact?.socket_ids?.length ) {
                    contact.online = true;
                    contact.last_seen = null;
                }
                else {
                    contact.online = false;
                }
            }
            if (!contactsList[contact.user_id]?.chat_id) {
                contact.last_message_info = null;
            }
            else {
                // add last message info
            }
            // removing fields that are not needed
            delete contact.settings;
            delete contact.socket_ids;

            return contact;
        })

        res.status(200).send(polished_contacts_info);
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router