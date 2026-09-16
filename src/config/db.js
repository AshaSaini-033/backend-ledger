const mongoose = require("mongoose")

function connectToDB() {
    mongoose.connect(process.env.MONGO_URI).then(() => {
        console.log("server is connected to DB")
    })
        .catch(err => {
            console.log("Error Connecting to Db ", err)
            process.exit(1)
        })
}
module.exports = connectToDB
