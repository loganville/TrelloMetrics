const functions = require('firebase-functions');

const moment = require('moment');
const rp = require("request-promise-native");

const api_key = functions.config().trello.api_key;
const access_key = functions.config().trello.access_key;
const board = functions.config().trello.board;
const list = functions.config().trello.list;
const week_count = 20;

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

exports.generateData = functions.https.onRequest((request, response) => {
    let promises = [];
    for (let count = 0; count < 10; count++) {
        let random_start_hours = Math.random() * 3378;
        let random_cycle_time = Math.random() * 440;
        let time_in = moment().subtract(random_start_hours, 'hours');
        let time_out = time_in.clone().add(random_cycle_time, 'hours');
        promises.push(new Promise((resolve) => {
            return db.collection('cards').doc()
                .set({
                    time_in: time_in,
                    time_out: time_out,
                    defect: Math.random() >= 0.95
                }, {merge: true});
        }));
    }
    Promise.all(promises).then(() => {
        response.set('Access-Control-Allow-Origin', '*');
        response.status(200);
    });
});

exports.defectRate = functions.https.onRequest((request, response) => {
    let promises = [];
    for (let week = week_count; week >= 0; week--) {
        promises.push(new Promise((resolve) => {
            return db.collection("cards")
                .where("defect", "==", true)
                .where("time_in", ">", moment().startOf('isoWeek').subtract(week, 'weeks'))
                .where("time_in", "<", moment().endOf('isoWeek').subtract(week, 'weeks'))
                .get()
                .then(cards => {
                    resolve(cards.size);
                });
        }));
    }
    Promise.all(promises).then(function (values) {
        response.set('Access-Control-Allow-Origin', '*');
        response.status(200).send(values);
        return values;
    });
});

exports.cardCount = functions.https.onRequest((request, response) => {
    let promises = [];
    for (let week = week_count; week >= 0; week--) {
        promises.push(new Promise((resolve) => {
            return db.collection("cards")
                .where("time_in", ">", moment().startOf('isoWeek').subtract(week, 'weeks'))
                .where("time_in", "<", moment().endOf('isoWeek').subtract(week, 'weeks'))
                .get()
                .then(cards => {
                    resolve(cards.size);
                });
        }));
    }
    Promise.all(promises).then(function (values) {
        response.set('Access-Control-Allow-Origin', '*');
        response.status(200).send(values);
        return values;
    });
});

exports.cycleTime = functions.https.onRequest((request, response) => {
    let promises = [];
    for (let week = week_count; week >= 0; week--) {
        promises.push(new Promise((resolve) => {
            return db.collection("cards")
                .where("time_in", ">", moment().startOf('isoWeek').subtract(week, 'weeks'))
                .where("time_in", "<", moment().endOf('isoWeek').subtract(week, 'weeks'))
                .get()
                .then(cards => {
                    let hours = 0;
                    cards.forEach((card) => {
                        let end = moment();
                        if (card.get('time_out') != null) {
                            end = moment(card.data().time_out.toDate());
                        }
                        const start = moment(card.data().time_in.toDate());
                        hours += end.diff(start, 'hours');
                    });
                    const cycleTime = Number.parseFloat((hours / 24 / Math.max(cards.size, 1)).toFixed(2));
                    resolve(cycleTime);
                });
        }));
    }
    Promise.all(promises).then(function (values) {
        response.set('Access-Control-Allow-Origin', '*');
        response.status(200).send(values);
        return values;
    });
});

exports.getCategories = functions.https.onRequest((request, response) => {
    let results = [];
    for (let week = week_count; week >= 0; week--) {
        results.push(moment().startOf('isoWeek').subtract(week, 'weeks').format('MMM DD'));
    }
    response.set('Access-Control-Allow-Origin', '*');
    response.status(200).send(results);
    return results;
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