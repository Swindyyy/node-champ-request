"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const paladins_json_1 = __importDefault(require("../assets/paladins.json"));
const marvel_rivals_json_1 = __importDefault(require("../assets/marvel-rivals.json"));
const app_2 = require("../app");
initFirebase();
const db = (0, firestore_1.getFirestore)();
const dbQueue = db.collection('queue');
var router = express_1.default.Router();
const itemListMap = new Map();
itemListMap.set('paladins', paladins_json_1.default.items);
itemListMap.set('marvel-rivals', marvel_rivals_json_1.default.items);
if (db) {
    /* GET request for list of champions */
    router.get('/queue/:queueType', (req, res) => {
        dbQueue.doc(req.params.queueType).get().then(result => {
            const resultToSend = formatDocumentData(JSON.stringify(result.data()));
            res.send(JSON.stringify(resultToSend));
        }).catch(err => {
            console.log(err);
            res.status(500).send(err);
        });
    });
    /* GET request for list of champions */
    router.get('/queue-items/:queueType', (req, res) => {
        const itemListToSend = itemListMap.get(req.params.queueType);
        res.send(JSON.stringify(itemListToSend));
    });
    /* GET request for Champion Request Queue */
    router.get('/queue/all', (req, res) => {
        // quotesCollection.find().toArray().then(
        //   result => {
        //     res.send(result);
        //   }).catch(err => {
        //     console.log(err);
        //     res.status(500).send(err);
        //   });
    });
    /* DELETE request for Champion Request Queue */
    router.delete('/queue/:queueType/all', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedItemsReq = yield dbQueue.doc(req.params.queueType).set({});
        app_2.wss.getWss().clients.forEach(client => {
            client.send(JSON.stringify({
                command: 'wipeQueue',
                data: {
                    queueType: req.params.queueType
                }
            }));
        });
        res.status(200).send("Deleted all entries in queue");
    }));
    /* DELETE request for Champion Request Queue */
    router.delete('/queue/:queueType/last-played', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const currentQueue = yield dbQueue.doc(req.params.queueType).get();
        const formattedQueue = formatDocumentData(JSON.stringify(currentQueue.data())).sort((a, b) => {
            return a.createdAt < b.createdAt ? -1 : 0;
        });
        ;
        const dataToSet = {};
        const deletedItem = formattedQueue.shift();
        formattedQueue.forEach((item) => { dataToSet[item.createdAt] = item.queueItemDataName; });
        const deletedItemsReq = yield dbQueue.doc(req.params.queueType).set(Object.assign({}, dataToSet));
        app_2.wss.getWss().clients.forEach(client => {
            client.send(JSON.stringify({
                command: 'removeLastPlayed',
                data: {
                    queueType: req.params.queueType
                }
            }));
        });
        res.status(200).send("Succesfully deleted champion from front of queue");
    }));
    router.post('/queue/:queueType/:championName', (req, res) => {
        let championName = req.params.championName;
        let matchedItem = matchQueueItem(championName, itemListMap.get(req.params.queueType));
        if (matchedItem !== '') {
            const currentServerTime = new Date().toISOString();
            dbQueue.doc(req.params.queueType).set({
                [currentServerTime]: matchedItem
            }, { merge: true }).then(result => {
                console.log(JSON.stringify(result));
                app_2.wss.getWss().clients.forEach(client => {
                    client.send(JSON.stringify({
                        command: 'addToQueue',
                        data: {
                            queueType: req.params.queueType,
                            queueData: {
                                createdAt: currentServerTime,
                                queueItemDataName: matchedItem
                            }
                        }
                    }));
                });
            }).catch(err => console.log(err));
        }
        res.send('Got POST request for /queue/');
    });
}
else {
    console.error("FIRESTORE DID NOT CONNECT - Please check the credentials");
    process.exit();
}
module.exports = router;
function matchQueueItem(itemName, listToCheck) {
    let itemFound = '';
    console.log("Finding champion : " + itemName);
    listToCheck.forEach(item => {
        if (itemFound !== '')
            return itemFound;
        if (item.name.toLowerCase() === itemName.toLowerCase()) {
            itemFound = item.name;
        }
        else {
            item.nicknames.forEach(nickname => {
                if (nickname.toLowerCase() === itemName.toLowerCase()) {
                    itemFound = item.name;
                }
            });
        }
    });
    if (itemFound !== '')
        return itemFound;
    let words = itemName.split(' ');
    listToCheck.forEach(item => {
        if (itemFound !== '')
            return itemFound;
        words.forEach(wordToSearch => {
            if (itemFound !== '')
                return itemFound;
            if (item.name.toLowerCase() === wordToSearch.toLowerCase()) {
                itemFound = item.name;
            }
            else {
                item.nicknames.forEach(nickname => {
                    if (nickname.toLowerCase() === wordToSearch.toLowerCase()) {
                        itemFound = item.name;
                    }
                });
            }
        });
    });
    return itemFound;
}
function formatDocumentData(rawDataString) {
    const resultsJSON = JSON.parse(rawDataString);
    const resultToSend = [];
    Object.entries(resultsJSON).forEach(([key, value]) => {
        resultToSend.push({
            createdAt: key,
            queueItemDataName: value
        });
    });
    return resultToSend;
}
function initFirebase() {
    const serviceAccount = {
        "type": "service_account",
        "project_id": process.env.PROJECT_ID,
        "private_key_id": process.env.PRIVATE_KEY_ID,
        "private_key": process.env.PRIVATE_KEY,
        "client_email": process.env.CLIENT_EMAIL,
        "client_id": process.env.CLIENT_ID,
        "auth_uri": process.env.AUTH_URI,
        "token_uri": process.env.TOKEN_URI,
        "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
        "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
        "universe_domain": process.env.UNIVERSE_DOMAIN
    };
    const creds = serviceAccount;
    (0, app_1.initializeApp)({
        credential: (0, app_1.cert)(creds),
        databaseURL: 'swindys-request-queue.firebaseio.com'
    });
}
