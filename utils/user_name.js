const client = require('../config/database');

/**
 * 
 * @param {string} displayName - display name of the user
 * @returns {string} username
 */
async function generateUserName(displayName) {
    // remove all white space from display name
    displayName = (displayName.replace(/\s/g, "")).toLowerCase();

    const username_collection = client.db("LinkUp").collection("user names");

    // getting username from database
    const username_db = await username_collection.findOne({ displayName: displayName }, { projection: { _id: 0 } });

    if (!username_db) { // if username doesn't exist
        username_collection.insertOne({ displayName: displayName, id: null });
        return displayName;
    } else { // if username exists
        const db_username_id = username_db.id;
        if (db_username_id === null) {
            username_collection.updateOne({ displayName: displayName }, { $set: { id: 1 } });
            return `${displayName}1`;
        } else {
            username_collection.updateOne({ displayName: displayName }, { $set: { id: db_username_id + 1 } });
            return `${displayName}${db_username_id + 1}`;
        }
    }
}

module.exports = generateUserName