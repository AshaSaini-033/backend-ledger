const { Router } = require('express')
const authMiddleware = require("../middelware/auth.middleware")
const transactionController = require("../controllers/transaction.controller")

const transactionRoutes = Router()

transactionRoutes.post("/", authMiddleware.authMiddleware, transactionController.createTransaction)


//cretae initial funds from system user 
transactionRoutes.post("/system/initial-funds", authMiddleware.authSystemUserMiddleware, transactionController.createInitialFundsTransaction)

module.exports = transactionRoutes

