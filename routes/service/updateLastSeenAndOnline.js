const router = require("express").Router();
const client = require("../../config/database");
const joi = require("joi");
const { io } = require("../../config/webSocket");

router.post("/", async (req, res) => {
    try {
        const { user_id, socket_room_id } = req.user;
        const { new_value } = req.body;

        // validating data
        try {
            await joi.boolean().required().validateAsync(new_value);
        } catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }

        const accounts_coll = client.db("LinkUp").collection("accounts");
        const result = await accounts_coll.updateOne({ user_id: user_id }, 
            { $set: { last_seen: null, settings: { last_seen_and_online: new_value }}});
        if (result.modifiedCount === 1) {
            // syncing with other tabs
            // LSAS : last seen and status
            io.to(socket_room_id).emit("LSAS_update_sync", new_value);
            // informing contacts
            if (new_value) {
                io.to(user_id).emit("user_connected", user_id);
            } else {
                io.to(user_id).emit("user_disconnected", user_id);
            }
            return res.status(200).send();
        }
        res.status(400).send("Failed to update last seen");
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router