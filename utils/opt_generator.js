const client = require('../config/database');

/**
 * @description generates otp and saves it in database
 * @param {string} type - currently generate otp for either registration or password reset
 * @param {string} email - email of the user
 * @returns {number} otp
 */
function generateOTP(type, email) {
    let otp;
    if (type === "registration") {
        // generating otp from 1000 to 4999 for registration
        otp = Math.floor(Math.random() * 4000) + 1000;
    } else if (type === "password_reset") {
        // generating otp from 5000 to 9999 for password reset
        otp = Math.floor(Math.random() * 5000) + 5000;
    }
    else {
        return new Error("Invalid type");
    }

    saveOTP(otp, email);
    return otp;
}

async function saveOTP(otp, email) {
    const otp_coll = client.db("LinkUp").collection("otp");
    const current_time = new Date();
    const otp_obj = {
        otp_code: otp,
        date_created: current_time.toUTCString(),
        expires: new Date(current_time.setMinutes(new Date().getMinutes() + 3)).toUTCString(),
        email: email
    }

    // check if email already exists
    const user = await otp_coll.countDocuments({ email: email });
    if (user > 0) {
        // updating pre existing data
        await otp_coll.updateOne({ email: email }, { $set: otp_obj });
    } else {
        // inserting new data
        await otp_coll.insertOne(otp_obj);
    }
}

module.exports = generateOTP