const functions = require('firebase-functions');

const rp = require("request-promise-native");
const api_key = functions.config().trello.api_key;
const access_key = functions.config().trello.access_key;
const board = functions.config().trello.board;

exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
});

exports.getCards = functions.https.onRequest((request, response) => {
    const options = {
        uri: 'https://api.trello.com/1/boards/' + board + '/cards',
        qs: {
            fields: 'name',
            key: api_key,
            token: access_key,
        },
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true
    };

    rp(options)
        .then(function (cards) {
            response.status(200).send(cards);
            return cards;
        })
        .catch(function (err) {
            response.status(500).send(err);
            return err;
        });
});