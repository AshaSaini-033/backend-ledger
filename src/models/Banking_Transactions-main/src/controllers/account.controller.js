const accountModel = require("../models/account.model");

async function createAccountController(req , res){

const user = req.user ;

const account = await accountModel.create({
    user : user._id
});


res.status(201).json({
    message: "account created",
    account: account
});



}


async function getuserAccountsController(req , res){

    const user = req.user;
    const accounts = await accountModel.find({user: user._id});

    res.status(200).json({accounts});

}

async function getuserAccountsBalanceController(req , res){
    const {accountId} = req.params;

    const account = await accountModel.findOne({
        _id:accountId ,
        user : req.user._id
    });

    if(!account){
        return res.status(404).json({
            message : "Account not found"
        });
    }


    const balance = await account.getBalance();

    res.status(200).json({accountId : account._id , balance:balance});

}



module.exports = {createAccountController , getuserAccountsController , getuserAccountsBalanceController };