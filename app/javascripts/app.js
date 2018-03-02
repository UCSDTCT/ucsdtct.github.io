// Import RSA functions.
import * as rsa from "./rsa.js";

// Import cookies (for auto-saving private key)
import Cookies from 'js-cookie';

// Require jQuery
var $ = require("jquery");

// Require Materialize CSS
require("materialize-loader");
import * as Materialize from 'materialize-css/dist/js/materialize.min.js';
import 'materialize-css/dist/css/materialize.min.css';

// Import the page's CSS.
import "../stylesheets/app.css";

// Import smart contract libraries.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract';

// Import our contract artifacts and turn them into usable abstractions.
import dmail_artifacts from '../../build/contracts/Dmail.json';

// Usable abstraction, which we'll use through the code below.
var Dmail = contract(dmail_artifacts);

// The account of the current user (should equal the one MetaMask refers to)
var account;

// Global constants
const TOAST_DURATION = 3000;
const ERROR_TOAST_DURATION = 5000;

window.App = {

  /**
   * Starts the application. Responsible for mailbox setup too.
   */
  start: function() {
    var self = this; // NECESSARY: `this` changes when entering callback functions

    // Return early if we are not on the right page
    if (!document.getElementById('use-mailbox')) {
      return;
    }

    // Set the smart contract's provider.
    Dmail.setProvider(web3.currentProvider);

    // Get the user's account.
    account = web3.eth.accounts[0];

    // Disable mailbox if we don't have a valid account
    if (account === undefined) {
      $('#loading-mailbox').addClass('hide');
      $('#disable-mailbox').removeClass('hide');
      return;
    }

    // Update the address display
    $('#display-address').text("Your address is "+account+".");

    // Change screens (loading -> setup/use)
    $('#loading-mailbox').addClass('hide');

    self.getPublicKeyPEM(account, function (err, pem_public_key) {
      if (err) {
        Materialize.toast("An error occurred. Press F12 to see details.", ERROR_TOAST_DURATION);
        console.log(err);
      }
      // Account has no public key on the blockchain
      else if (pem_public_key == undefined) {
        $('#setup-mailbox').removeClass('hide');

        Materialize.toast("Generating keys ...", TOAST_DURATION);

        rsa.keygen(function(err, keypair) {
          if (err) {
            Materialize.toast("An error occurred. Press F12 to see details.", ERROR_TOAST_DURATION);
            console.log(err);
          }
          else {
            Materialize.toast("Uploading public key ...", TOAST_DURATION);

            // Serialize keypair
            var pem_formats = rsa.serialize(keypair);

            // Save private key to cookies
            Cookies.set('address', account);
            Cookies.set('privatekey', pem_formats.privateKey);

            // Upload public key to the blockchain
            App.uploadPublicKey(account, pem_formats.publicKey, function (err) {
              if (err) {
                Materialize.toast("An error occurred. Press F12 to see details.", ERROR_TOAST_DURATION);
                console.log(err);
              }
              else {
                Materialize.toast("Done!", TOAST_DURATION);

                // Handle displays
                $('#display-private-key').text(pem_formats.privateKey);
                $('#display-public-key').text(pem_formats.publicKey);
                $('#doing-keygen').addClass('hide');
                $('#finished-keygen').removeClass('hide');
              }
            });
          }
        });
      }
      // Account has a public key on the blockchain
      else {
        self.open();
      }
    });
  },

  /**
   * Opens the mailbox usage screen and handles all actions there.
   */
  open: function() {
    var self = this;

    $('#setup-mailbox').addClass('hide');
    $('#use-mailbox').removeClass('hide');
  },

  /**
   * Returns the PEM of the public key corresponding to the provided Ethereum address.
   * Queries the blockchain to retrieve the PEM.
   *
   * @param  {Object}   address  The ethereum address whose public key we want to retrieve
   * @param  {Function} callback A function taking an error and a public key PEM (if successful, error will be null)
   */
  getPublicKeyPEM: function(address, callback) {
    var self = this;

    var inst;
    Dmail.deployed().then(function(instance) {
      inst = instance;
      return inst.getKey.call(address, {from: address});
    }).then(function(value) {
      if (value.valueOf().length == 0) {
        callback(null, undefined);
      }
      else {
        callback(null, value.valueOf());
      }
    }).catch(function(err) {
      callback(err, null);
    });
  },

  /**
   * Returns the PEM of the private key.
   * The function first checks the browser cache to see if a private key exists there. If a private key
   * does it exist, it then checks to see if the private key's address corresponds to MetaMask's address.
   * If no private key is found in the browser cache or a different private key is found, it asks the user
   * to input the key in directly.
   *
   * @param  {Object}   address  The ethereum address whose private key we want to retrieve
   * @param  {Function} callback A function taking an error and a private key PEM (if successful, error will be null)
   */
  getPrivateKeyPEM: function(address, callback) {
    var self = this;

    var pem = undefined;

    // The user's account matches the saved address associated with the private key
    if (Cookies.get('address') == String(address)) {
      pem = Cookies.get('privatekey');
    }

    // Private key does not exist
    if (pem == undefined) {
      // TODO: Ask user to input their private key
    }

    callback(null, pem);
  },

   /**
    * Uploads the given public key to the blockchain under the given Ethereum address.
    *
    * @param  {Object}   address    The ethereum address whose public key we are uploading
    * @param  {Object}   public_key A Forge public key
    * @param  {Function} callback   A function taking an error (if upload was successful, error will be null)
    */
  uploadPublicKey: function(address, public_key, callback) {
    var self = this;

    var inst;
    Dmail.deployed().then(function(instance) {
      inst = instance;
      return inst.setKey(public_key, {from: address});
    }).then(function() {
      callback(null);
    }).catch(function(err) {
      callback(err);
    });
  },

  /**
   * Sends a message in ciphertext to the receiver's address on the blockchain.
   *
   * @param  {Object}   sender_address      The sender's Ethereum address
   * @param  {String}   sender_message      The message the sender wants to send to the receiver
   * @param  {Object}   receiver_address    The receiver's Ethereum address
   * @param  {Object}   receiver_public_key The receiver's forge public key
   * @param  {Function} callback            A function taking an error (if upload was successful, error will be null)
   */
  uploadMessage: function(sender_address, sender_message, receiver_address, receiver_public_key, callback) {
    var self = this;

    var inst;
    Dmail.deployed().then(function(instance) {
      inst = instance;
      var ciphertext = rsa.encrypt(sender_message, receiver_public_key);
      return inst.sendMail(receiver_address, ciphertext, {from: sender_address});
    }).then(function() {
      callback(null);
    }).catch(function(err) {
      callback(err);
    });
  }
};

$(document).ready(function() {
  // Associate buttons with JS
  $('#setup-done-button').click(function() {
    App.open();
  });
  $('#message-form').submit(function(e) {
    // Prevent page from refreshing
    e.preventDefault();

    // Collect all of the form's values
    var values = {
      recipient: $('#recipient').val(),
      message: $('#message').val()
    };

    // Append 0x to front of Ethereum address if not there
    if (values.recipient.length == 40) {
      values.recipient = '0x' + values.recipient;
    }

    // Check recipient address
    if (values.recipient.length !== 42) {
      Materialize.toast("Please enter a valid recipient address!", TOAST_DURATION);
      return;
    }

    // Check message
    if (values.message.length == 0) {
      Materialize.toast("Please enter a message!", TOAST_DURATION);
      return;
    }

    Materialize.toast("Encrypting message ...", TOAST_DURATION);

    // Get the public key of the user we want to send to
    App.getPublicKeyPEM(values.recipient, function(err, pem) {
      if (err) {
          Materialize.toast("An error occurred. Press F12 to see details.", ERROR_TOAST_DURATION);
          console.log(err);
      }
      else {
        var public_key = rsa.deserialize_public_key(pem);

        Materialize.toast("Posting ciphertext to blockchain ...", TOAST_DURATION);

        // Send a message to them using their own private key
        App.uploadMessage(account, values.message, values.recipient, public_key, function(err) {
          if (err) {
            Materialize.toast("An error occurred. Press F12 to see details.", ERROR_TOAST_DURATION);
            console.log(err);
          }
          else {
            Materialize.toast("Message sent!", TOAST_DURATION);
            $('#recipient').val("");
            $('#message').val("");
          }
        });
      }
    })
  });

  // Make page visible
  $('body').addClass('loaded');

  if (typeof web3 !== 'undefined') {
    // Provider (Metamask, etc.) found. Inject it into the window.
    window.web3 = new Web3(web3.currentProvider);
    $('#loading-mailbox').removeClass('hide');
  } else {
    // No provider found!
    $('#disable-mailbox').removeClass('hide');
  }

  App.start();
});
