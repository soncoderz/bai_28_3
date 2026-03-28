var createError = require('http-errors');
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
let mongoose = require('mongoose');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', require('./routes/index'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/carts', require('./routes/cart'));
app.use('/api/v1/upload', require('./routes/upload'));

let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/NNPTUD-C4';
mongoose.connect(mongoUri);
mongoose.connection.on('connected', function () {
  console.log('connected');
});
mongoose.connection.on('disconnected', function () {
  console.log('disconnected');
});
mongoose.connection.on('disconnecting', function () {
  console.log('disconnecting');
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send(err.message);
});

module.exports = app;
