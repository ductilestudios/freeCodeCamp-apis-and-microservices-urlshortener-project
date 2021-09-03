require('dotenv').config();
var express = require('express');
var cors = require('cors');
var dns = require('dns');
var URL = require('url').URL;
var bodyParser = require('body-parser');
var app = express();
var mongoose = require('mongoose');
const { send } = require('process');

// Connect to database
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Database Connection Successful!");
});

// Basic Configuration
var port = process.env.PORT || 3000;
const TIMEOUT = 10000;

//Mongoose Url Schema and Model Setup
var urlSchema = new mongoose.Schema ({
  longUrl: {
    type: String,
    required: true,
    unique: true
  },
  shortUrl: {
    type: Number,
    required: true,
    unique: true
  }
});

var Url = mongoose.model('Url', urlSchema);

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.use('/api/shorturl', bodyParser.urlencoded({extended:false}));

// Verify valid url
const verifyUrl = (urlString) => {
  var urlRegex = '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
  var url = new RegExp(urlRegex, 'i');
  return url.test(urlString);
}

//Find the next short Url in the sequence and return it in callback
const findNextShortUrl = (req, res, next) => {
  let lastShort = Url.find()
    .sort({shortUrl: -1})
    .limit(1)
    .exec(function(err, data) {
      if (err) console.error(err);
      res.locals.nextShort = data[0].shortUrl + 1;
      next();
    });
};


//Find the matching document given a long url
const longUrlFind = (req, res, next) => {
  Url.findOne({longUrl: req.body.url}, function(err, data) {
    if (err) console.error(err);
    res.locals.url = data;
    next();
  });
};


//Express routing
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post('/api/shorturl', longUrlFind, findNextShortUrl, async function(req, res) {
  if (!verifyUrl(req.body.url)) {
    res.send({ error: 'invalid url' });
  } else if (res.locals.url) {
    res.send({"original_url": res.locals.url.longUrl, "short_url": res.locals.url.shortUrl});
  } else {
    var newShortUrl = new Url({
      longUrl: req.body.url,
      shortUrl: res.locals.nextShort,
    })
    let result = await newShortUrl.save();
  
    return res.send({"original_url": result.longUrl, "short_url": result.shortUrl});
  }
});

app.get('/api/shorturl/:entry', function(req, res) {
  Url.findOne({shortUrl: req.params.entry}, function(err, data) {
    if (err) console.error(err);
    res.redirect(data.longUrl);
  });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
