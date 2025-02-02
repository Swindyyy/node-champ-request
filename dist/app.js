"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
var helmet = require('helmet');
dotenv_1.default.config();
// const serviceAccount = require('./serviceAccount.json');
// var createError = require('http-errors');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');
// var cors = require('cors');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const config_port = process.env.PORT;
const PORT = Number.parseInt(config_port, 10) || 3000;
const app = (0, express_1.default)();
// view engine setup
app.set('views', path_1.default.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
var helmet = require('helmet');
app.use(helmet());
app.use('/', indexRouter);
app.use('/users', usersRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    res.send('ERROR');
});
// error handler
app.use(function (err, req, res) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
// start the Express server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`server started at http://localhost:${process.env.PORT || PORT}`);
});
module.exports = app;
