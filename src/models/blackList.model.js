const mongoose = require("mongoose");

const tokenBlackListSchema = new mongoose.Schema({

    token: {
        type: String,
        required: [true, "Token is required to Blacklist."],
        unique: true
    },
    blackListedAt :{
        type:Date,
        default :Date.now,
        immutable:true
    }

},{
    timestamps : true
});

// TTL index: tokens auto-delete after 3 days (same as JWT expiry)
tokenBlackListSchema.index({ blackListedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 3 });

const tokenBlackListModel = mongoose.model("tokenBlackList" , tokenBlackListSchema);

module.exports = {tokenBlackListModel};