const express = require("express");
const transactionrouter = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const createTransaction = require("../controllers/transaction.controller");

//-POST /api/transactions/
// -  Create a new transaction

transactionrouter.post("/" , authMiddleware.authMiddleware , createTransaction.createTransaction );

// -POSt /api/transactions/system/initial-funds
// -CREATE initial funds transaction from System User
transactionrouter.post("/system/initial-funds" , authMiddleware.systemUserAuthMiddleware , createTransaction.createInitialFuncdstransaction);


module.exports = transactionrouter 