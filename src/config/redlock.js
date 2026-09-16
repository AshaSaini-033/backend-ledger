// Redlock configuration / fallback
module.exports = {
    acquire: async (keys, duration) => {
        return {
            release: async () => {}
        };
    }
};
