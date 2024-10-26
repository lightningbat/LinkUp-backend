const { removeSocketIds, updateLastSeen } = require("../utils");
const { black, bgRed, bgYellow } = require('ansis')
const client = require("../../config/database");

module.exports = async (socket, reason) => {

    // removing socket id from database
    removeSocketIds(socket.user.user_id, [socket.id]);

    // getting active socket ids from database
    const accounts_coll = client.db("LinkUp").collection("accounts");
    const user_socket_ids = await accounts_coll.findOne({ user_id: socket.user.user_id }, { projection: {_id: 0, socket_ids: 1 } });

    // if user is not connected to any socket
    if (user_socket_ids.socket_ids.length === 0) {
        console.log(black.bgRed(socket.user.username));

        // updating last seen in the database
        updateLastSeen(socket.user.user_id);

        socket.broadcast.in(socket.user.user_id).emit("user_disconnected", socket.user.user_id);
    }
    else {
        console.log(black.bgYellow(socket.user.username));
    }
}