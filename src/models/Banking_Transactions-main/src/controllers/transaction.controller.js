const transactionModel = require("../models/transaction.model");
const jwt = require("jsonwebtoken");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");
const redLock = require("../config/redlock");


/**

* - Create a new transaction
* THE 10-STEP TRANSFER FLOW:
* 1. Validate request
2. Validate idempotency key
3. Check account status
* 4. Derive sender balance from ledger
* 5. Create transaction (PENDING)
6. Create DEBIT ledger entry
* 7. Create CREDIT ledger entry
* 8. Mark transaction COMPLETED
* 9. Commit MongoDB session
* 10. Send email notification

*/

async function createTransaction(req, res) {

    // 1.validate request 

    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "please provide all details. fromAccount , toAccount , amount , idempotencyKey"
        });
    }

    if (
    !mongoose.Types.ObjectId.isValid(fromAccount) ||
    !mongoose.Types.ObjectId.isValid(toAccount)
) {
    return res.status(400).json({
        message: "Invalid account ID"
    });
}


    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
        message: "Amount must be a positive number"
    });
}

    if (fromAccount === toAccount) {
    return res.status(400).json({
        message: "Sender and receiver accounts must be different"
    });
}

    const findFromAccount = await accountModel.findOne({
        _id: fromAccount
    });
    if (!findFromAccount) {
        return res.status(400).json({
            message: "provide a valid sender account"
        });
    }
    const findToAccount = await accountModel.findOne({
        _id: toAccount
    });
    if (!findToAccount) {
        return res.status(400).json({
            message: "provide a valid receiver account"
        });
    }



    // 2.validate idempotency key 

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    });

    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "COMPLETED") {
            return res.status(200).json({
                message: "Payment Successful",
                transaction: isTransactionAlreadyExists
            });
        }

        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                message: "Payment Pending/Processing"
            });
        }

        if (isTransactionAlreadyExists.status === "FAILED") {
            return res.status(400).json({
                message: "Payment Failed"
            });
        }
        if (isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(400).json({
                message: "Payment is Reversed , please retry"
            });
        }


    }

    // 3.check account status 

    // if transaction already not exists so 

    // to check if from or to menas sender or receiver account is closed or prozen 

    // const isSenderAccountActive = await accountModel.findOne({
    //     fromAccount:fromAccount
    // });


    if (findFromAccount.status != "ACTIVE" || findToAccount.status != "ACTIVE") {
        return res.status(403).json({
            message: "sender account and receiver account both should be Active"
        });
    }


    // 4 . Derive Sender balance from ledger



let transaction;

const accountKeys = [
    `account:${fromAccount}`,
    `account:${toAccount}`
].sort();


let lock;



try {

     lock = await redLock.acquire(
    accountKeys,
    10000
);
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {

            // yahan transaction ka saara DB work aayega
            const senderAccount = await accountModel.findOne({
    _id: fromAccount
}).session(session);

if (!senderAccount) {
    throw new Error("SENDER_ACCOUNT_NOT_FOUND");
}


const receiverAccount = await accountModel.findOne({
  _id: toAccount
}).session(session);

if (!receiverAccount) {
  throw new Error("RECEIVER_ACCOUNT_NOT_FOUND");
}

const balance = await senderAccount.getBalance(session);


    if (balance < amount) {
    throw new Error("INSUFFICIENT_BALANCE");
}

 // 5. Create transaction (PENDING)
// Part of the MongoDB transaction
        transaction = new transactionModel({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        });
        await transaction.save({session}); // This saves it to DB so retries will see "PENDING"

          await ledgerModel.create([{
                account: fromAccount,
                amount: amount,
                transaction: transaction._id,
                type: "DEBIT"
            }], { session });


                     // 7. Create CREDIT ledger entry
            await ledgerModel.create([{
                account: toAccount,
                amount: amount,
                transaction: transaction._id,
                type: "CREDIT"
            }], { session });


                   transaction.status = "COMPLETED";
            await transaction.save({ session });

   

        });
    } finally {
        await session.endSession();
    }

} catch (error) {

    if (error.code === 11000) {
        return res.status(409).json({
            message: "Payment is already processing"
        });
    }

    if (error.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({
            message: `Insufficient balance`
        });
    }

    if (error.message === "RECEIVER_ACCOUNT_NOT_FOUND") {
    return res.status(404).json({
        message: "Receiver account not found"
    });
}

if (error.name === "ExecutionError") {
    return res.status(423).json({
        message: "Another transaction is already processing this account. Please retry."
    });
}
if (
    error.message?.toLowerCase().includes("redis") ||
    error.message?.toLowerCase().includes("connection")
) {
    return res.status(503).json({
        message: "Transaction service temporarily unavailable. Please retry."
    });
}
    console.error("Transaction error:", error);

    return res.status(400).json({
        message: "Transaction failed due to an issue."
    });
}
finally {
  if (lock) {
        try {
            await lock.release();
        } catch (err) {
            console.error(
                "Failed to release Redis lock:",
                err.message
            );
        }
    }
}

    // try {







     

    //     const session = await mongoose.startSession();
    //     session.startTransaction();
        
    //     try {
    //         // 6. Create DEBIT ledger entry
          

   

    //         // 8. Mark transaction COMPLETED
     
    //     } catch (innerError) {
    //         await session.abortTransaction();
    //         session.endSession();
            
    //         // Mark transaction as FAILED if something went wrong inside the session
    //         transaction.status = "FAILED";
    //         await transaction.save();
    //         throw innerError;
    //     }

    // } catch (error) {
    //     if (error.code === 11000) {
    //         return res.status(409).json({ message: "Payment is already processing" });
    //     }
    //     return res.status(400).json({
    //         message: "Transaction failed due to an issue."
    //     });
    // }



    // * 10. Send email notification

    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);


    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transaction
    });
}

async function createInitialFuncdstransaction(req, res) {

    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "please provide all details. - toAccount , amount , idempotencyKey"
        });
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if (!toUserAccount) {
        return res.status(400).json({
            message: "provide a valid receiver account"
        });
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    });

    if (!fromUserAccount) {
        return res.status(400).json({
            message: "System User account not found"
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({

        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING",


    });

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    }], {
        session
    });



    const creditLedgerEntry = await ledgerModel.create([{
        account: toUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"
    }], {
        session
    });

    transaction.status = "COMPLETED";
    await transaction.save({ session });

    await session.commitTransaction();

    session.endSession();



    return res.status(201).json({
        message: "Initial Funds Transaction completed successfully",
        transaction: transaction
    });

}

module.exports = { createTransaction, createInitialFuncdstransaction };