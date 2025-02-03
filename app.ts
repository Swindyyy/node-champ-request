import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import cookieParser from 'cookie-parser';
import path from 'path';
import logger from 'morgan';
import cors from 'cors';
import WebSocket from "ws";

var helmet = require('helmet');
dotenv.config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');



const config_port: string = process.env.PORT as string;
const PORT = Number.parseInt(config_port, 10) || 3000;
const app = express();

// start the Express server
const httpServer = app.listen(PORT, () => {
  console.log(`server started at http://localhost:${process.env.PORT || PORT}`);
});


const env_wsPort = process.env.WS_PORT as string;
const wsPort = Number.parseInt(env_wsPort, 10) || 3030;
const sockjs_opts = {
  prefix: '/echo'
};

export const wss = new WebSocket.Server({ port: wsPort, noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  })
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var helmet = require('helmet');
app.use(helmet());

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.send('ERROR')
});

// error handler
app.use(function (err: any, req: any, res: any) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
