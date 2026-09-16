const mongoose = require("mongoose")
// require("dotenv")
function connectDB() {


mongoose.connect(process.env.MONGO_URI).then(()=>{
    console.log("connected to DB");
}).catch(err => {
    console.log("error connecting to DB");
    process.exit(1);
});
}

module.exports = connectDB