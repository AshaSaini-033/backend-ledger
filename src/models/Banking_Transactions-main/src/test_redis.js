const redLock = require("./config/redlock");

async function worker(name) {

    try {
        const lock = await redLock.acquire(
            ["account:test123"],
            10000
        );

        console.log(`${name} 🔒 Lock Acquired`);

        await new Promise(resolve =>
            setTimeout(resolve, 5000)
        );

        await lock.release();

        console.log(`${name} 🔓 Lock Released`);

    } catch (error) {
        console.log(`${name} ❌ Could not acquire lock`);
    }
}

worker("Worker A");
worker("Worker B");