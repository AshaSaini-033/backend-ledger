const { default: Redlock } = require("redlock");
const redis = require("./redis");

const redLock = new Redlock([redis] , {
    retryCount:10,
    retryDelay:200,
    retryJitter:100
});

module.exports = redLock;