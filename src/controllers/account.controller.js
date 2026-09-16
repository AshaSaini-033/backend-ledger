const accountModel = require("../models/account.model")
const mongoose = require("mongoose")

async function createAccountController(req, res) {
    try {
        const user = req.user
        const { currency } = req.body || {}

        const account = await accountModel.create({
            user: user._id,
            currency: currency || "INR"
        })

        return res.status(201).json({
            account
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error creating account: " + error.message,
            status: "failed"
        })
    }
}

async function getUserAccountsController(req, res) {
    try {
        const user = req.user
        const accounts = await accountModel.find({ user: user._id })

        return res.status(200).json({
            status: "success",
            accounts
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error fetching accounts: " + error.message,
            status: "failed"
        })
    }
}

async function getAccountBalanceController(req, res) {
    try {
        const { accountId } = req.params
        const user = req.user

        let filter

        if (accountId) {
            if (!mongoose.Types.ObjectId.isValid(accountId)) {
                return res.status(400).json({
                    message: "Invalid account ID format"
                })
            }
            filter = user.systemUser
                ? { $or: [{ _id: accountId }, { user: accountId }] }
                : { $or: [{ _id: accountId }, { user: accountId }] }
        } else {
            // Default: find account for logged-in user
            filter = { user: user._id }
        }

        const account = await accountModel.findOne(filter)

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            })
        }

        const balance = await account.getBalance()

        return res.status(200).json({
            account,
            balance
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error fetching balance: " + error.message
        })
    }
}

module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
}
