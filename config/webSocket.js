const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

// initializing web socket
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["POST"],
    },
});

/**
 * @param {string[]} socket_ids - list of socket ids
 * @returns {string[]} - list of socket ids that are no longer active
 */
const getInActiveSocketIds = async (socket_ids) => {
    const active_socket_ids = await Promise.all(
        socket_ids.map(async (socket_id) => {
            const socket = io.sockets.sockets.get(socket_id);
            if (socket) {
                return socket_id;
            }
        })
    );
    return socket_ids.filter((socket_id) => !active_socket_ids.includes(socket_id));
}

module.exports = { app, httpServer, io, getInActiveSocketIds }