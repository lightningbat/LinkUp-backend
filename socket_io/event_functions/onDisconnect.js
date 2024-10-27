const { removeSocketIds, updateLastSeen } = require("../utils");
const { black, bgRed, bgYellow } = require('ansis')
const client = require("../../config/database");

module.exports = async (socket, reason) => {

    // removing socket id from database
    await removeSocketIds(socket.user.user_id, [socket.id]);

    // getting active socket ids from database
    const accounts_coll = client.db("LinkUp").collection("accounts");
    const user_info = await accounts_coll.findOne({ user_id: socket.user.user_id }, 
        { projection: {_id: 0, socket_ids: 1, settings: { last_seen_and_online: 1 } } });

    const user_socket_ids = user_info?.socket_ids || [];

    // if user is not connected to any socket
    if (user_socket_ids.length === 0) {
        console.log(black.bgRed(socket.user.username));

        // if user has disabled last seen and status
        if (!user_info.settings.last_seen_and_online) return;

        // updating last seen in the database
        const last_seen = await updateLastSeen(socket.user.user_id);

        // not broadcasting when user has disabled last seen and status
        // because updating last_seen_and_status express route already broadcasted
        socket.in(socket.user.user_id).emit("user_disconnected", 
            {user_id: socket.user.user_id, last_seen: last_seen});
    }
    else {
        console.log(black.bgYellow(socket.user.username));
    }
}