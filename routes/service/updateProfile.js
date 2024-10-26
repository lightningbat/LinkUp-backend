const router = require("express").Router();
const client = require("../../config/database");
const { display_name_schema } = require("../../schemas");
const user_name_generator = require("../../utils/user_name");

const { io } = require("../../config/webSocket");

router.post("/", async (req, res) => {
    try {
        const { user_id, socket_room_id } = req.user;
        const { display_name } = req.body;

        // validating data
        if (!display_name) return res.status(400).send("Please provide display name");
        try {
            await display_name_schema.validateAsync(req.body);
        }catch (err) {
            return res.status(400).json({ type: err.details[0].context.label, message: err.message });
        }

        // generating username
        const user_name = await user_name_generator(display_name);

        const accounts_coll = client.db("LinkUp").collection("accounts");
        // updating display name and username in database
        const result = await accounts_coll.updateOne({ user_id: user_id }, 
            { $set: { display_name: display_name, username: user_name } });
        if (result.modifiedCount === 1) {
            // emiting to all contacts
            io.to(user_id).emit("contact_profile_update", { user_id: user_id, display_name: display_name, username: user_name });
            // emiting to own socket (for syncing)
            io.to(socket_room_id).emit("profile_update_sync", { display_name: display_name, username: user_name });
            return res.status(200).send();
        }
        res.status(400).send("Failed to update profile");
    }
    catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
})

module.exports = router