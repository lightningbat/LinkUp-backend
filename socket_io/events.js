const { io } = require("../config/webSocket")
const verifyToken = require("../middlewares/socketio/auth");
const { black, bgGreen, bgRed } = require('ansis')
const { getUserInfo, manageActiveSocketIds } = require("./utils");

const { onDisconnect } = require("./event_functions");

io.use(verifyToken);

io.on("connection", async (socket) => {
    // getting user info from database
    const userInfo = await getUserInfo(socket.user.user_id);

    // getting user info from returned data from database
    const user_socket_ids = userInfo?.socket_ids || [];
    let user_contacts = [];
    if (userInfo?.chat_contacts) {
        user_contacts = Object.keys(userInfo?.chat_contacts);
    }

    // storing current username in socket
    socket.user.username = userInfo.username;

    // removing inactive socket ids
    const active_socket_ids = await manageActiveSocketIds(socket.user.user_id, user_socket_ids, socket.id);

    // storing active socket ids in socket
    socket.user.socket_ids = [...active_socket_ids, socket.id];

    console.log(black.bgGreen(userInfo.username));

    // joining own socket room (for syncing)
    socket.join(userInfo.socket_room_id);
    // joining user's contacts socket rooms
    if (user_contacts.length) {
        user_contacts.forEach((contact_id) => {
            socket.join(contact_id);
        })
    }

    // broadcast the current user online status
    // if user is connected to only one socket (i.e. the current socket)
    if (socket.user.socket_ids.length == 1) socket.broadcast.in(socket.user.user_id).emit("user_connected", socket.user.user_id);

    /* ********* EVENT: DISCONNECT ********* */
    socket.on("disconnect", async (reason) => onDisconnect(socket, reason));

    /* ********* EVENT: JOIN NEW CONTACT ROOM ********* */
    // front-end informing about adding a new contact
    // => to join the newly added contact's room, to get real time updates of the contact
    // e.g. real time online status, change of display name and profile image, etc
    socket.on("join_new_contact_room", (contact_id) => {
        socket.join(contact_id);
    });

})