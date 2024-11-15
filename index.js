require('dotenv').config();
const client = require('./config/database');
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const authenticator = require('./middlewares/express/auth');
const sizeof = require('object-sizeof');

const { app, httpServer } = require('./config/webSocket');

/* ***** SOCKET IO ***** */
require('./socket_io/events');

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://192.168.43.79:5173",],
        methods: ["POST"],
    })
)

// This catches any uncaught errors that occur in the Node.js process and logs them to the console.
// This is useful for catching any errors that occur outside of the normal error handling mechanisms of the application.
// It is also useful for catching any errors that occur in the socket.io connection event handlers, because those errors are not caught by the normal error handling mechanisms of the application.
process.on("uncaughtException", (err) => {
    console.log("Uncaught Exception\n", err);
})

try{
    ( async () => client.connect() );
    console.log("Connected to MongoDB");
}
catch(err){
    console.log("Failed to connect to MongoDB");
}

const min = 1
const limiter = rateLimit({
    windowMs: min * 60 * 1000, // 1 minutes
    limit: 50, // Limit each IP to x requests per `window` (here, per y minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
        res.status(429).json({ type: "limit", message: "Too many requests. Please try again later" });
    }
})

app.use(express.json())
app.use(limiter)
app.use((req, res, next) => {
    const excluded_route = ['/setProfilePic'];
    // console.log("payload size : ", sizeof(req.body));
    if (excluded_route.includes(req.path)) {
        if (sizeof(req.body) > 200000) { // 200kb
            return res.status(400).json({ type: "size limit", message: "Request too large. Please try again later" });
        }
        next();
    }
    else {
        if (sizeof(req.body) > 5000) { // 500 bytes
            return res.status(400).json({ type: "size limit", message: "Request too large. Please try again later" });
        }
        next();
    }
})


app.use("/register", require('./routes/authentication/register'));
app.use("/login", require('./routes/authentication/login'));
app.use("/verifyOTP", require('./routes/authentication/verifyOTP'));
app.use("/resendOTP", require('./routes/authentication/resendOTP'));
app.use("/forgot-password", require('./routes/authentication/forgotPass'));
app.use("/reset-password", require('./routes/authentication/resetPass'));

app.use(authenticator);

app.use("/setProfilePic", require('./routes/service/setProfilePic'));
app.use("/deleteProfilePic", require('./routes/service/delProfilePic'));
app.use("/getUser", require('./routes/service/getUser'));
app.use("/findUser", require('./routes/service/findUser'));
app.use("/addContact", require('./routes/service/addContact'));
app.use("/getContactsDetail", require('./routes/service/getContactsDetail'));
app.use("/getContactsOnlineStatus", require('./routes/service/getContactsOnlineStatus'));
app.use("/updateProfile", require('./routes/service/updateProfile'));
app.use("/updateLastSeenAndOnline", require('./routes/service/updateLastSeenAndOnline'));


const port = process.env.PORT || 3000;

httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})