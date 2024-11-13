const client = require("../../config/database");
const joi = require("joi");

module.exports = async (socket, contact_id) => {
    // validate contact_id
    const uuid_schema = joi.string().guid({ version: 'uuidv4' }).required();
    try {
        await uuid_schema.validateAsync(contact_id);
    } catch (err) {
        return;
    }

    // getting chat id
    const accounts_coll = client.db("LinkUp").collection("accounts");
    const user_info = await accounts_coll.findOne({ user_id: socket.user.user_id }, 
        { projection: { _id: 0, [`chat_contacts.${contact_id}.chat_id`]: 1 } });
    const chat_id = user_info?.chat_contacts?.[contact_id]?.chat_id;

    if (!chat_id) return;

    const chat_coll = client.db("LinkUp").collection("chats");
    // getting chat number if not present
    if (!socket.chat_numbers) socket.chat_numbers = {};
    if (!socket?.chat_numbers[chat_id]) {
        const user_numbers = await chat_coll.findOne({ chat_id }, { projection: { _id: 0, user_1: 1, user_2: 1 } });
        const chat_number = user_numbers?.user_1 == socket.user.user_id ? 1 : 2;
        socket.chat_numbers[chat_id] = chat_number;
    }

    // resetting unread count
    await chat_coll.updateOne({ chat_id }, {$set: {[`user_${socket.chat_numbers[chat_id]}_unread_count`]: 0}});
}