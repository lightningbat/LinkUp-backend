const router = require("express").Router();

router.post("/", async (req, res) => {
    try{

    }
    catch(err){
        console.log(err);
        res.status(500).send(err.message);
    }
})