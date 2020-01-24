const functions = require('firebase-functions');

const moment = require('moment');
const rp = require("request-promise-native");

const api_key = functions.config().trello.api_key;
const access_key = functions.config().trello.access_key;
const board = functions.config().trello.board;
const list = functions.config().trello.list;

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
let db = admin.firestore();

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

exports.updateData = functions.pubsub.schedule('every 23 hours').onRun((context) => {
    const yesterday = moment().subtract(1, 'days');

    const options = {
        uri: 'https://api.trello.com/1/board/' + board + '/actions',
        qs: {
            filter: 'updateCard:idList',
            member: false,
            fields: 'data,date',
            memberCreator: false,
            key: api_key,
            token: access_key,
            since: yesterday.format()
        },
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true
    };

    return rp(options)
        .then(function (actions) {
            console.log(actions);
            actions.forEach(action => {
                if (action.data.listBefore.id === list) {
                    return db.collection('cards').doc(action.data.card.id).set({
                        time_out: admin.firestore.Timestamp.fromDate(new Date(action.date)),
                    }, {merge: true});
                } else if (action.data.listAfter.id === list) {
                    return db.collection('cards').doc(action.data.card.id).set({
                        time_in: admin.firestore.Timestamp.fromDate(new Date(action.date)),
                    }, {merge: true});
                }
            });
        })
        .catch(function (err) {
            throw err;
        });
});

exports.defectRate = functions.https.onRequest((request, response) => {
    db.collection("cards")
        .where("defect", "==", true)
        .where( "time_in", "<", moment().subtract(0, 'weeks'))
        .where( "time_in", ">", moment().subtract(5, 'weeks'))
        .get()
        .then(snap => {
            response.status(200).send({length: snap.size});
        });
});

exports.checkLabel = functions.firestore.document('cards/{cardId}').onWrite((change, context) => {
    if (change.after.exists) {
        const options = {
            uri: 'https://api.trello.com/1/cards/' + context.params.cardId + '/labels',
            qs: {
                key: api_key,
                token: access_key
            },
            headers: {
                'User-Agent': 'Request-Promise'
            },
            json: true
        };

        return rp(options)
            .then(function (labels) {
                labels.forEach(label => {
                    if (label.name === "defect") {
                        return db.collection('cards').doc(context.params.cardId).set({
                            defect: true,
                        }, {merge: true});
                    }
                });
            })
            .catch(function (err) {
                throw err;
            });
    }
});