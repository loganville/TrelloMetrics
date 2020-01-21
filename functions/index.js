const functions = require('firebase-functions');

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

exports.getBoards = functions.https.onCall((data, context) => {
 const Trello = require("trello");
 const api_key = functions.config().trello.api_key;
 const access_key = functions.config().trello.access_key;
 const trello = new Trello(api_key, access_key);
});
