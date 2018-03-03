var forge = require('node-forge');

/**
 * Generates the keys needed for RSA. ASYNCHRONOUS.
 *
 * @param  {Function} callback A callback function taking in a keypair as a parameter
 */
function keygen(callback) {
  forge.pki.rsa.generateKeyPair({bits: 2048, workers: 2}, callback);
}

/**
 * Serializes a forge keypair into an object containing the PEM data of both keys.
 *
 * @param  {Object} keypair The forge keypair
 * @return {Object}         The keypair in PEM format
 */
function serialize(keypair) {
  return {
    publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
  };
}

/**
 * Deserializes the public key individually.
 *
 * @param  {String} pem The public key in PEM format
 * @return {Object}     Forge public key object
 */
function deserialize_public_key(pem) {
  return forge.pki.publicKeyFromPem(pem);
}

/**
 * Deserializes the private key individually.
 *
 * @param  {String} pem The private key in PEM format
 * @return {Object}     Forge private key object
 */
function deserialize_private_key(pem) {
  return forge.pki.privateKeyFromPem(pem);
}

/**
 * Decrypts message using the receiver's private key.
 * Defaults to RSAES PKCS#1 v1.5.
 *
 * @param  {Byte[]} bytes      Some encrypted sequence of bytes
 * @param  {Object} privateKey The receiver's private key (forge object)
 * @return {String}            The original message written by the sender
 */
function decrypt(bytes, privateKey) {
  var decrypted = privateKey.decrypt(bytes);
  return forge.util.decodeUtf8(decrypted);
}

/**
 * Encrypts message using the receiver's public key.
 * Defaults to RSAES PKCS#1 v1.5.
 *
 * @param  {String} message   The sender's message
 * @param  {Object} publicKey The receiver's public key (forge object)
 * @return {Byte[]}           The original
 */
function encrypt(message, publicKey) {
  var bytes = forge.util.encodeUtf8(message);
  return publicKey.encrypt(bytes);
}

export { keygen, decrypt, encrypt, serialize, deserialize_public_key, deserialize_private_key }
