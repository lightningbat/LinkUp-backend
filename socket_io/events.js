const { io } = require("../config/webSocket")
const verifyToken = require("../middlewares/socketio/auth");
const { black, bgGreen, bgRed } = require('ansis')
const { getBasicUserInfo, removeSocketIds, manageActiveSocketIds } = require("./utils");

const { onDisconnect } = require("./event_functions");

io.use(verifyToken);

io.on("connection", async (socket) => {
    // getting user info from database
    const basicUserInfo = await getBasicUserInfo(socket.user.user_id);
    const user_socket_ids = basicUserInfo?.socket_ids || [];

    // storing current username in socket
    socket.user.username = basicUserInfo.username;

    // removing inactive socket ids
    const active_socket_ids = await manageActiveSocketIds(socket.user.user_id, user_socket_ids, socket.id);

    // storing active socket ids in socket
    socket.user.socket_ids = [...active_socket_ids, socket.id];
    
    console.log(black.bgGreen(basicUserInfo.username));


    /* ********* EVENT: DISCONNECT ********* */
    socket.on("disconnect", async (reason) => onDisconnect(socket, reason)); 
})