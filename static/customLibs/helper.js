var crypto = require('crypto');

module.exports = {

    genKeyPair: function () {
        // Generate keys
        return crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'pkcs1', 
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs1', 
                format: 'pem'
            }
        });


    },

    encryptWithPublicKey: function (publicKey, message) {
        const bufferMessage = Buffer.from(message, "utf8");

        return crypto.publicEncrypt(publicKey, bufferMessage);
    },

    decryptWithPrivateKey: function (privateKey, encryptedMessage) {
        return crypto.privateDecrypt(privateKey, encryptedMessage);
    },

    genPasscode: function () {
        return Math.floor(100000 + Math.random() * 900000);
    },

    hash: function (message) {
        return crypto.createHash('sha3-512').update(message, 'utf-8').digest('base64');
    },

}