const transactionModel = require("../models/transaction.model");
const jwt = require("jsonwebtoken");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");
const redLock = require("../config/redlock");

/**
 * Create a new transaction
 */
async function createTransaction(req, res) {
    // 1. Validate request
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

    const findFromAccount = await accountModel.findOne(
        mongoose.Types.ObjectId.isValid(fromAccount)
            ? { $or: [{ _id: fromAccount }, { user: fromAccount }] }
            : { _id: fromAccount }
    );
    if (!findFromAccount) {
        return res.status(400).json({
            message: "provide a valid sender account (Account ID or User ID)"
        });
    }
    const findToAccount = await accountModel.findOne(
        mongoose.Types.ObjectId.isValid(toAccount)
            ? { $or: [{ _id: toAccount }, { user: toAccount }] }
            : { _id: toAccount }
    );
    if (!findToAccount) {
        return res.status(400).json({
            message: "provide a valid receiver account (Account ID or User ID)"
        });
    }

    // 2. Validate idempotency key
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

    // 3. Check account status
    if (findFromAccount.status !== "ACTIVE" || findToAccount.status !== "ACTIVE") {
        return res.status(403).json({
            message: "sender account and receiver account both should be Active"
        });
    }

    let transaction;

    const accountKeys = [
        `account:${findFromAccount._id}`,
        `account:${findToAccount._id}`
    ].sort();

    let lock;

    try {
        lock = await redLock.acquire(accountKeys, 30000);
    } catch (error) {
        if (error.name === "ExecutionError") {
            return res.status(423).json({
                message: "Another transaction is already processing this account. Please retry."
            });
        }
        return res.status(503).json({
            message: "Transaction service temporarily unavailable. Please retry."
        });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // --- Re-check idempotency key INSIDE lock (no auto-retry here) ---
        const existingTx = await transactionModel.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
            await session.abortTransaction();
            if (existingTx.status === "COMPLETED") {
                return res.status(200).json({
                    message: "Payment Successful",
                    transaction: existingTx
                });
            }
            if (existingTx.status === "PENDING") {
                return res.status(200).json({
                    message: "Payment Pending/Processing"
                });
            }
        }

        const senderAccount = await accountModel.findOne({
            _id: findFromAccount._id
        }).session(session);

        if (!senderAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Sender account not found" });
        }

        const receiverAccount = await accountModel.findOne({
            _id: findToAccount._id
        }).session(session);

        if (!receiverAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Receiver account not found" });
        }

        const balance = await senderAccount.getBalance(session);

        if (balance < amount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Insufficient balance" });
        }

        // Create transaction (PENDING) — unique index on idempotencyKey is DB-level guard
        transaction = new transactionModel({
            fromAccount: findFromAccount._id,
            toAccount: findToAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING"
        });
        await transaction.save({ session });

        // Commit PENDING immediately so other requests see it
        await session.commitTransaction();

        // ---------------------------------------------------------------
        // Optional delay OUTSIDE session to test PENDING idempotency
        await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
        // ---------------------------------------------------------------

        // Open a new session for the DEBIT/CREDIT + COMPLETED writes
        const session2 = await mongoose.startSession();
        try {
            session2.startTransaction();

            await ledgerModel.create([{
                account: findFromAccount._id,
                amount,
                transaction: transaction._id,
                type: "DEBIT"
            }], { session: session2 });

            await ledgerModel.create([{
                account: findToAccount._id,
                amount,
                transaction: transaction._id,
                type: "CREDIT"
            }], { session: session2 });

            transaction.status = "COMPLETED";
            await transaction.save({ session: session2 });

            await session2.commitTransaction();
        } catch (err) {
            await session2.abortTransaction();
            // Mark transaction as FAILED
            try {
                await transactionModel.findByIdAndUpdate(transaction._id, { status: "FAILED" });
            } catch (_) {}
            throw err;
        } finally {
            session2.endSession();
        }

    } catch (error) {
        try { await session.abortTransaction(); } catch (_) {}

        if (error.code === 11000) {
            return res.status(200).json({ message: "Payment Pending/Processing" });
        }

        console.error("Transaction error:", error);
        return res.status(400).json({
            message: "Transaction failed: " + error.message
        });
    } finally {
        session.endSession();
        if (lock) {
            try { await lock.release(); } catch (err) {
                console.error("Failed to release Redis lock:", err.message);
            }
        }
    }

    // Send email notification
    if (req.user?.email) {
        try {
            await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);
        } catch (emailErr) {
            console.error("Failed to send transaction email:", emailErr.message);
        }
    }

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transaction
    });
}

async function createInitialFundsTransaction(req, res) {
    if (!req.user) {
        return res.status(401).json({
            message: "Unauthorized access, authentication required"
        });
    }

    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "please provide all details. - toAccount , amount , idempotencyKey"
        });
    }

    const toUserAccount = await accountModel.findOne(
        mongoose.Types.ObjectId.isValid(toAccount)
            ? { $or: [{ _id: toAccount }, { user: toAccount }] }
            : { _id: toAccount }
    );

    if (!toUserAccount) {
        return res.status(400).json({
            message: "provide a valid receiver account (Account ID or User ID)"
        });
    }

    let fromUserAccount = await accountModel.findOne({
        user: req.user._id
    });

    if (!fromUserAccount) {
        fromUserAccount = await accountModel.create({
            user: req.user._id,
            currency: "INR"
        });
    }

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    });

    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "COMPLETED") {
            return res.status(200).json({
                message: "Initial Funds Transaction completed successfully",
                transaction: isTransactionAlreadyExists
            });
        }
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const transaction = new transactionModel({
            fromAccount: fromUserAccount._id,
            toAccount: toUserAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING"
        });
        await transaction.save({ session });

        await ledgerModel.create([{
            account: fromUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        await ledgerModel.create([{
            account: toUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session });

        transaction.status = "COMPLETED";
        await transaction.save({ session });

        await session.commitTransaction();

        return res.status(201).json({
            message: "Initial Funds Transaction completed successfully",
            transaction: transaction
        });
    } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({
            message: "Error processing initial funds: " + error.message
        });
    } finally {
        session.endSession();
    }
}

module.exports = { createTransaction, createInitialFundsTransaction };