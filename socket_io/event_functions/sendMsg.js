const client = require("../../config/database");
const { getInActiveSocketIds } = require("../../config/webSocket");
const { removeSocketIds } = require("../utils");
const { v4: uuidv4 } = require("uuid");
const joi = require("joi");

module.exports = async (socket, payload, callback) => {
    const sender_id = socket.user.user_id;
    // Defensive code
    if (!sender_id || sender_id === payload.contact_id) {
        callback({status:401, message: "Can't send message to yourself"});
        return;
    }

    // validating payload
    try{
        // Defensive code
        if (!payload || !payload.msg_type) {
            callback({status: 400, message: "Invalid payload"});
            return;
        }
        const uuidv4_schema = joi.string().guid({ version: 'uuidv4' }).required();
        const msg_type_schema = joi.number().min(1).max(2).required();
        const msg_schema = payload.msg_type == 1 ? 
            joi.string().required().min(1).max(500) // text
                :
            joi.string().dataUri().required(); // image
        await Promise.all([
            uuidv4_schema.validateAsync(payload.contact_id), 
            msg_type_schema.validateAsync(payload.msg_type), 
            msg_schema.validateAsync(payload.msg)
        ]);
    } catch (err) {
        callback({status: 400, message: err.message});
        return;
    }
    
    // getting receiver's information
    const accounts_coll = client.db("LinkUp").collection("accounts");
    const contact_info = await accounts_coll.findOne({ user_id: payload.contact_id }, 
        { projection: { _id: 0, socket_room_id: 1, socket_ids: 1, chat_contacts: { [sender_id]: 1 } } });
        
    if (!contact_info) {
        callback({status: 400, message: "Contact not found"});
        return;
    }
    
    const msg_id = uuidv4();
    const timestamp = Date.now();
    const chat_id = contact_info.chat_contacts?.[sender_id]?.chat_id || uuidv4();

    // receiver already has sender in their contacts, (just haven't sent a message yet)
    const isNewChat = !contact_info?.chat_contacts?.[sender_id]?.chat_id ? true : false;
    // receiver doesn't have sender in their contacts
    const isNewContact = !contact_info?.chat_contacts?.[sender_id] ? true : false;
    
    // chat_id already exists (i.e., both users have already been chatting)
    if (!isNewChat) {
        callback({status: 200, msg_id: msg_id, timestamp: timestamp});
    }
    else {
        callback({status: 200, msg_id: msg_id, timestamp: timestamp, chat_id: chat_id});
        const updateChatId = async (user_id, contact_id, chat_id) => {
            await accounts_coll.updateOne({ user_id: user_id }, 
                { $set: { [`chat_contacts.${contact_id}.chat_id`]: chat_id } });
        }
        // updating sender's chat_id
        const update_sender_chat_id = updateChatId(sender_id, payload.contact_id, chat_id);
        // adding new contact in the receiver's contacts list
        const adding_contact = isNewContact ?
            // creating new chat contact
            addNewChatContact(sender_id, payload.contact_id, chat_id, timestamp, contact_info.socket_room_id, socket)
                :
            // just updating chat_id
            updateChatId(payload.contact_id, sender_id, chat_id);
        // creating new chat document in the database
        const creating_new_chat = createNewChatDocument(sender_id, payload.contact_id, chat_id);
        await Promise.all([adding_contact, creating_new_chat, update_sender_chat_id]);

        // setting the number assign in the chat document
        // since here a new chat document is being created
        // and current socket is the sender
        // so therefore it has been assign as user_1 in the chat document
        if (!socket.chat_numbers) socket.chat_numbers = {};
        socket.chat_numbers[chat_id] = 1; // chat number of the current user
    }

    // syncing messages across all sockets of the sender
    socket.broadcast.in(socket.user.socket_room_id).emit("sync_msg",
        {
            receiver_id: payload.contact_id,
            msg_id: msg_id,
            timestamp: timestamp,
            msg_type: payload.msg_type,
            msg: payload.msg,
            chat_id: isNewChat ? chat_id : null
        }
    )
    
    // writing message to the database
    await writeMsgToDatabase(
        {
            msg_id,
            timestamp,
            msg_type: payload.msg_type,
            msg: payload.msg,
            sender_id,
            edited: false
        },
        chat_id, socket
    )

    const is_receiver_online = isContactOnline(payload.contact_id, contact_info?.socket_ids || []);
    
    // not sending message if
    // 1. contact is offline
    // 2. contact has blocked
    if (!is_receiver_online || contact_info?.chat_contacts?.[sender_id]?.blocked) return

    socket.in(contact_info.socket_room_id).emit("receive_msg", {
        sender_id: socket.user.user_id,
        msg_id: msg_id,
        timestamp: timestamp,
        msg_type: payload.msg_type,
        msg: payload.msg,
        edited: false,
        chat_id: isNewChat ? chat_id : null
    });
    
}

function isContactOnline( contact_id, socket_ids ) {
    // if socket_ids array is empty
    if (!socket_ids?.length) return false;

    // getting list of socket ids that are no longer active
    const inActiveSocketIds = getInActiveSocketIds(socket_ids);
    // asynchronously removing inactive socket ids of the contact
    if (inActiveSocketIds.length) removeSocketIds(contact_id, inActiveSocketIds);
    // if all socket ids are inactive
    if (inActiveSocketIds.length == socket_ids.length) return false;
    return true;
}

/**
 * 
 * @param {Object} msg_data
 * @param {uuidv4} msg_data.msg_id
 * @param {number|string} msg_data.timestamp
 * @param {number} msg_data.msg_type
 * @param {string} msg_data.msg
 * @param {uuidv4} msg_data.sender_id
 * @param {boolean} msg_data.edited
 * @param {uuidv4} chat_id 
 * @param {Socket} socket 
 */
async function writeMsgToDatabase(msg_data, chat_id, socket) {
    // creating field to store the number assigned in the chat document
    if (!socket.chat_numbers) socket.chat_numbers = {};

    const chat_coll = client.db("LinkUp").collection("chats");
    
    // getting chat number from the database
    if (!socket?.chat_numbers[chat_id]) {
        // getting chat number from the chat document
        const user_numbers = await chat_coll.findOne({ chat_id }, { projection: { _id: 0, user_1: 1, user_2: 1 } });
        const chat_number = user_numbers?.user_1 == socket.user.user_id ? 1 : 2;
        socket.chat_numbers[chat_id] = chat_number;
    }

    // writing message to the database and updating other fields
    await chat_coll.updateOne({ chat_id }, 
        {$push: { chats: {
            msg_id: msg_data.msg_id,
            timestamp: msg_data.timestamp,
            msg_type: msg_data.msg_type,
            msg: msg_data.msg,
            sender: socket.chat_numbers[chat_id],
            edited: msg_data.edited
        }},
        $inc: { [`user_${socket.chat_numbers[chat_id] == 1 ? 2 : 1}_unread_count`]: 1 },
        $set: { 
            last_message_info: {
                msg_id: msg_data.msg_id,
                timestamp: msg_data.timestamp,
                msg_type: msg_data.msg_type,
                msg: msg_data.msg,
                sender: socket.chat_numbers[chat_id]
            }
        }
    });
}



/**
 * @description - adds new contact in the receiver's contacts list(in the database) and sends new contact info to the receiver(client side)
 * @param {uuidv4} sender_id 
 * @param {uuidv4} receiver_id 
 * @param {uuidv4} chat_id 
 * @param {number|string} timestamp
 * @param {uuidv4} receiver_socket_room_id 
 * @param {Socket} socket 
 */
async function addNewChatContact(sender_id, receiver_id, chat_id, timestamp, receiver_socket_room_id, socket) {
    // adding new contact in the receiver's contacts list
    const accounts_coll = client.db("LinkUp").collection("accounts");
    accounts_coll.updateOne({ user_id: receiver_id }, 
        {$set: {[`chat_contacts.${sender_id}`]: { chat_id : chat_id, blocked: false, timestamp: timestamp } }});

    // getting sender's information
    const sender_info = await accounts_coll.findOne({ user_id: sender_id }, 
        { projection: { _id: 0,
            display_name: 1,
            profile_img: 1,
            bgColor: 1,
            username: 1
        } });

    // sending new contact info to the receiver
    socket.in(receiver_socket_room_id).emit("newContact", {
        user_id: sender_id,
        ...sender_info,
        online: true,
        last_seen: null,
        chat_id: chat_id,
        timestamp: timestamp
    });
}



/**
 * @description - creates new chat document in the database
 * @param {uuidv4} sender_id 
 * @param {uuidv4} receiver_id 
 * @param {uuidv4} chat_id
 */
async function createNewChatDocument(sender_id, receiver_id, chat_id) {
    const chat_coll = client.db("LinkUp").collection("chats");
    const chat_doc = {
        chat_id,
        user_1: sender_id,
        user_2: receiver_id,
        user_1_unread_count: 0,
        user_2_unread_count: 0,
        last_message_info: {},
        chats: []
    }
    await chat_coll.insertOne(chat_doc);
}