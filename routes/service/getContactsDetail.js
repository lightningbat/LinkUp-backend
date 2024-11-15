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
        /* Defensive code */
        // removing current user from contacts list (if present)
        if (Object.keys(contactsList).includes(user_id)) {
            delete contactsList[user_id];
        }

        // holds
        // all contact ids from contactsList
        let contact_ids;
        // all chat ids from contactsList
        const chat_ids = []

        // validating requested payload
        try {
            // getting all contact ids from contactsList
            contact_ids = Object.keys(contactsList);

            // getting all chat ids from contactsList
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

        // database collections
        const accounts_coll = client.db("LinkUp").collection("accounts");
        const chat_coll = client.db("LinkUp").collection("chats");

        // getting all contact's info in a single query
        const all_contacts_info_promise = accounts_coll.find({ user_id: { $in: contact_ids } },
            {
                projection: {
                    _id: 0,
                    user_id: 1,
                    display_name: 1,
                    username: 1,
                    profile_img: 1,
                    bgColor: 1,
                    chat_contacts: { [user_id]: 1 }
                }
            }).toArray();

        // getting all chat's info in a single query
        const all_chats_info_promise = chat_coll.find({ chat_id: { $in: chat_ids } },
            {
                projection: {
                    _id: 0,
                    chat_id: 1,
                    user_1: 1,
                    user_2: 1,
                    user_1_unread_count: 1,
                    user_2_unread_count: 1,
                    last_message_info: 1
                }
            }).toArray();

        const [all_contacts_info, all_chats_info] = await Promise.all([all_contacts_info_promise, all_chats_info_promise]);

        if (!all_contacts_info || all_contacts_info.length === 0) {
            return res.status(400).send("Failed to get contacts");
        }

        const result = all_contacts_info.map((contact) => {
            // checking if contact has blocked the current user
            const has_blocked = contact?.chat_contacts?.[user_id]?.blocked || false;
            // deleting fields after retrieving info from it
            delete contact.chat_contacts;
            if (has_blocked) {
                // removing field if contact has blocked the current user
                contact.profile_img = null;
            }
            // returning if chat_id is not present
            if (!contactsList[contact.user_id]?.chat_id) {
                contact.last_message_info = null;
                return contact;
            }
            // getting chat info
            const chat_info = all_chats_info.find((chat) => chat.chat_id === contactsList[contact.user_id]?.chat_id);

            // returning if chat info is not present(probably some error)
            if (!chat_info) {
                contact.last_message_info = null;
                contact.unread_count = 0;
                return contact;
            }

            const chat_number = chat_info?.user_1 === user_id ? 1 : 2; // number assigned to the current user in the chat document
            // adding last message info (if present)
            if (chat_info?.last_message_info?.timestamp) {
                contact.last_message_info = {
                    ...chat_info.last_message_info,
                    sender: chat_info.last_message_info.sender === chat_number ? 1 : 2, // 1 for current user, 2 for other user
                }
            } else contact.last_message_info = null;
            contact.unread_count = chat_info[`user_${chat_number}_unread_count`] || 0;

            return contact;
        })

        return res.status(200).send(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
})

module.exports = router