const { removeSocketIds, updateLastSeen } = require("../utils");
const { black, bgRed } = require('ansis')

module.exports = async (socket, reason) => {
    console.log(black.bgRed(socket.user.username));

    // removing socket id from database
    removeSocketIds(socket.user.user_id, [socket.id]);

    // removing socket id from local list
    socket.user.socket_ids.splice(socket.user.socket_ids.indexOf(socket.id), 1);

    // if user is not connected to any socket
    if (socket.user.socket_ids.length === 0) {
        // updating last seen in the database
        updateLastSeen(socket.user.user_id);
    }
}