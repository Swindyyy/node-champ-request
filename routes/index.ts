import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { initializeApp, cert, applicationDefault, ServiceAccount } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, Filter } from "firebase-admin/firestore";
import { firestore } from "firebase-admin";
import paladins from '../assets/paladins.json';
import marvelRivals from '../assets/marvel-rivals.json';
import { wss } from "../app";
import expressWs from 'express-ws';

initFirebase();

const db = getFirestore();
const dbQueue = db.collection('queue');

var router = express.Router();

const itemListMap: Map<string, any> = new Map();
itemListMap.set('paladins', paladins.items);
itemListMap.set('marvel-rivals', marvelRivals.items);

if (db) {
  /* GET request for list of champions */
  router.get('/queue/:queueType', (req, res) => {
    dbQueue.doc(req.params.queueType).get().then(
      result => {
        const resultToSend = formatDocumentData(JSON.stringify(result.data()));

        res.send(JSON.stringify(resultToSend));
      }).catch(err => {
        console.log(err);
        res.status(500).send(err);
      });
  });

  /* GET request for list of champions */
  router.get('/champions', (req, res) => {
    res.send('Got a GET request at /champions')
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
  router.delete('/queue/:queueType/all', async (req, res) => {
    const deletedItemsReq = await dbQueue.doc(req.params.queueType).set({});

    wss.getWss().clients.forEach(client => {
      client.send(JSON.stringify({
        command: 'wipeQueue'
      }));
    });
    res.status(200).send("Deleted all entries in queue");
  });


  /* DELETE request for Champion Request Queue */
  router.delete('/queue/:queueType/last-played', async (req, res) => {
    const currentQueue = await dbQueue.doc(req.params.queueType).get();
    const formattedQueue = formatDocumentData(JSON.stringify(currentQueue.data())).sort((a, b) => {
      return a.createdAt < b.createdAt ? -1 : 0;
    });;

    const dataToSet: any = {};
    const deletedItem = formattedQueue.shift();
    formattedQueue.forEach((item) => { dataToSet[item.createdAt] = item.queueItemDataName })

    const deletedItemsReq = await dbQueue.doc(req.params.queueType).set({ ...dataToSet });

    wss.getWss().clients.forEach(client => {
      client.send(JSON.stringify({
        command: 'removeTopFromQueue'
      }));
    })

    res.status(200).send("Succesfully deleted champion from front of queue");
  });

  router.post('/queue/:queueType/:championName', (req, res) => {
    let championName = req.params.championName;
    let matchedItem = matchQueueItem(championName, itemListMap.get(req.params.queueType));

    if (matchedItem !== '') {
      const currentServerTime = new Date().toISOString();
      dbQueue.doc(req.params.queueType).set({
        [currentServerTime]: matchedItem
      }, { merge: true }).then(
        result => {
          console.log(JSON.stringify(result));
          wss.getWss().clients.forEach(client => {
            client.send(JSON.stringify({
              command: 'addToQueue',
              data: {
                queueType: req.params.queueType,
                queueItemDataName: matchedItem
              }
            }));
          });
        }
      ).catch(err => console.log(err));
    }

    res.send('Got POST request for /queue/')
  });

} else {
  console.error("FIRESTORE DID NOT CONNECT - Please check the credentials");
  process.exit();
}



module.exports = router;

function matchQueueItem(itemName: string, listToCheck: {
  name: string;
  nicknames: string[];
}[]) {
  let itemFound = '';

  console.log("Finding champion : " + itemName);
  listToCheck.forEach(item => {
    if (itemFound !== '') return itemFound;

    if (item.name.toLowerCase() === itemName.toLowerCase()) {
      itemFound = item.name;
    } else {
      item.nicknames.forEach(nickname => {
        if (nickname.toLowerCase() === itemName.toLowerCase()) {
          itemFound = item.name;
        }
      });
    }
  });

  if (itemFound !== '') return itemFound;
  let words = itemName.split(' ');
  listToCheck.forEach(item => {
    if (itemFound !== '') return itemFound;

    words.forEach(wordToSearch => {
      if (itemFound !== '') return itemFound;

      if (item.name.toLowerCase() === wordToSearch.toLowerCase()) {
        itemFound = item.name;
      } else {
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

function formatDocumentData(rawDataString: string): {
  createdAt: string;
  queueItemDataName: string;
}[] {
  const resultsJSON = JSON.parse(rawDataString) as Map<string, string>;

  const resultToSend: {
    createdAt: string;
    queueItemDataName: string;
  }[] = [];

  Object.entries(resultsJSON).forEach(([key, value]: [string, string]) => {
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
  const creds = serviceAccount as ServiceAccount;

  initializeApp({
    credential: cert(creds),
    databaseURL: 'swindys-request-queue.firebaseio.com'
  });
}
