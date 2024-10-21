const client = require("../../config/database");
const { getInActiveSocketIds } = require("../../config/webSocket");

const accounts_coll = client.db("LinkUp").collection("accounts");

/**
 * 
 * @param {string} user_id - uuid of the user
 * @returns {Promise<{username: string, socket_ids: string[], chat_contacts: object}}>}
 */
async function getUserInfo(user_id) {
    const result = await accounts_coll.findOne({ user_id }, {
        projection: {
            _id: 0, username: 1, socket_ids: 1, chat_contacts: 1
        }
    });
    return result;
}

/**
 * @description - adds a new socket id to the database
 * @param {string} user_id - uuid of the user
 * @param {string} socket_id - new socket id of the user to be added to the database
 */
const addSocketId = async (user_id, socket_id) => {
    await accounts_coll.updateOne({ user_id }, { $push: { socket_ids: socket_id } });
}

/**
 * @description - removes list of socket ids from the database
 * @param {UUID} user_id - uuid of the user
 * @param {string[]} socket_ids - list of socket ids to be removed from the database
 */
const removeSocketIds = async (user_id, socket_ids) => {
    await accounts_coll.updateOne({ user_id }, { $pull: { socket_ids: { $in: [...socket_ids] } } });
}

/**
 * @description - find and remove inactive socket ids and then add the current socket id to the database
 * @param {string} user_id - uuid of the user
 * @param {string[]} old_socket_ids - list of old socket ids
 * @param {string} current_socket_id - current socket id
 * @returns {Promise<string[]>} - list of active socket ids
 */
const manageActiveSocketIds = async (user_id, old_socket_ids, current_socket_id) => {
    // removing inactive socket ids
    if (old_socket_ids.length) {
        const filtered_socket_ids = await getInActiveSocketIds(old_socket_ids);
        if (filtered_socket_ids) {
            // removing inactive socket ids from old_socket_ids
            old_socket_ids = old_socket_ids.filter((socket_id) => {
                return !filtered_socket_ids.includes(socket_id);
            })
            await removeSocketIds(user_id, filtered_socket_ids);
        }
    }
    
    // adding current socket id to the database
    await addSocketId(user_id, current_socket_id);

    return old_socket_ids;
}

/**
 * @description - updates last seen in the database
 * @param {string} user_id - uuid of the user
 */
const updateLastSeen = async (user_id) => {
    await accounts_coll.updateOne({ user_id }, { $set: { last_seen: new Date() } });
}

module.exports = { getUserInfo, addSocketId, removeSocketIds, manageActiveSocketIds, updateLastSeen };