const client = require('../config/database');
const { v4: uuidv4 } = require("uuid");
const bgColor_list = require('../static/accounts_profile_bg_colors.json');
const base_user_settings = require('../static/base_user_settings.json');
const username_generator = require('./user_name')

/**
 * @function populateAccountsCollection
 * @description adds data to verified accounts collection
 * @param {Object} options - options for the account to be inserted
 * @param {string} options.display_name - display name of the account
 * @param {string} options.email - email of the account
 * @param {string} options.password - password of the account
 * @param {Date} options.joined_timestamp - joined timestamp of the account
 * @returns {Promise<{type: string, status: number, message: string, user_id: string}}>}
 */
async function populateAccountsCollection({ display_name, email, password, joined_timestamp } = {}) {
    try {
        if (!display_name || !email || !password || !joined_timestamp) {
            return { type: "server", status: 500, message: "Please provide all required fields" };
        }
        const accounts_coll = client.db("LinkUp").collection("accounts");

        /* Defensive code */
        // checking if account already exist
        const from_verified = await accounts_coll.countDocuments({ email: email });
        if (from_verified) {
            return { type: "email", status: 400, message: "Account already verified" };
        }

        const user_id = uuidv4();
        const socket_room_id = uuidv4(); // for web socket (to synchronize user's all sockets)
        const random_bgColor = bgColor_list[Math.floor(Math.random() * bgColor_list.length)];
        const username = await username_generator(display_name);

        const data_to_insert = {
            user_id: user_id,
            socket_room_id: socket_room_id,
            display_name: display_name,
            username: username,
            email: email,
            password: password,
            bgColor: random_bgColor,
            profile_img: null,
            joined_timestamp: joined_timestamp,
            verified_timestamp: new Date(),
            settings: base_user_settings
        }

        const result = await accounts_coll.insertOne(data_to_insert);
        if (result.acknowledged) {
            return { type: "success", status: 200, user_id: user_id };
            // also returning user_id to sign jwt
        }
        return { type: "server", status: 400, message: "Failed to insert data" };
    }
    catch (err) {
        console.error(err);
        return { type: "server", status: 500, message: err.message };
    }
}

module.exports = populateAccountsCollection