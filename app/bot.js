/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/
This bot is capable of using many of the core features of Botkit:
* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.
# RUN THE BOT:
  Create a new app via the Slack Developer site:
    -> http://api.slack.com
  Get a Botkit Studio token from Botkit.ai:
    -> https://studio.botkit.ai/
  Run your bot from the command line:
    clientId=<MY SLACK TOKEN> clientSecret=<my client secret> PORT=<3000> studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js
# USE THE BOT:
    Navigate to the built-in login page:
    https://<myhost.com>/login
    This will authenticate you with Slack.
    If successful, your bot will come online and greet you.
# EXTEND THE BOT:
  Botkit has many features for building cool and useful bots!
  Read all about it here:
    -> http://howdy.ai/botkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
var env = require('node-env-file');
//env(__dirname + '/.env');


if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
  process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    grafanaUser: process.env.grafanaUser,
    grafanaPass: process.env.grafanaPass,
    grafanaHTTP: process.env.grafanaHTTP,
    debug: true,
    scopes: ['bot'],
    studio_token: process.env.studio_token,
    studio_command_uri: process.env.studio_command_uri
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
// Mongo is automatically configured when deploying to Heroku
if (process.env.MONGO_URI) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.MONGO_URI});
    bot_options.storage = mongoStorage;
} else {
    bot_options.json_file_store = __dirname + '/.data/db/'; // store user data in a simple JSON format
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

if (!process.env.clientId || !process.env.clientSecret) {

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  webserver.get('/', function(req, res){
    res.render('installation', {
      studio_enabled: controller.config.studio_token ? true : false,
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })

  var where_its_at = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/';
  console.log('WARNING: This application is not fully configured to work with Slack. Please see instructions at ' + where_its_at);
}else {

  webserver.get('/', function(req, res){
    res.render('index', {
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })
  // Set up a simple storage backend for keeping a record of customers
  // who sign up for the app via the oauth
  require(__dirname + '/components/user_registration.js')(controller);

  // Send an onboarding message when a new team joins
  require(__dirname + '/components/onboarding.js')(controller);

  // enable advanced botkit studio metrics
  require('botkit-studio-metrics')(controller);

  var normalizedPath = require("path").join(__dirname, "skills");
  require("fs").readdirSync(normalizedPath).forEach(function(file) {
    require("./skills/" + file)(controller);
  });

  // This captures and evaluates any message sent to the bot as a DM
  // or sent to the bot in the form "@bot message" and passes it to
  // Botkit Studio to evaluate for trigger words and patterns.
  // If a trigger is matched, the conversation will automatically fire!
  // You can tie into the execution of the script using the functions
  // controller.studio.before, controller.studio.after and controller.studio.validate
  if (process.env.studio_token) {
      controller.on('direct_message,direct_mention,mention', function(bot, message) {
          controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
              if (!convo) {
                  // no trigger was matched
                  // If you want your bot to respond to every message,
                  // define a 'fallback' script in Botkit Studio
                  // and uncomment the line below.
                  // controller.studio.run(bot, 'fallback', message.user, message.channel);
              } else {
                  // set variables here that are needed for EVERY script
                  // use controller.studio.before('script') to set variables specific to a script
                  convo.setVar('current_time', new Date());
              }
          }).catch(function(err) {
              bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
              debug('Botkit Studio: ', err);
          });
      });
  } else {
      console.log('~~~~~~~~~~');
      console.log('NOTE: Botkit Studio functionality has not been enabled');
      console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
  }

  // Added new capabilities here
  var fs = require('fs'),
  request = require('request');

  var download = function(uri, filename, callback){
    console.log('Trigger donwload');
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
  };

  controller.on('slash_command', function (bot, message) {

    console.log('Slash Command received');
    var upload_file = "dashboard.png";

    var uploadDashboard = function(){
      console.log('Dashboard downloaded');
  
      bot.api.files.upload({
        //token: process.env.token,
        title: "Dashboard",
        filename: upload_file,
        filetype: "png",
        //content: "Posted with files.upload API",
        file: fs.createReadStream(upload_file),
        channels: message.channel
      }, function(err, response) {
        if (err) {
          console.log("Error (files.upload) " + err);
        } else {
          console.log("Success (files.upload) " + response);
        };
      });
    };
    
    switch (message.command) {
      case "/dashboard": //handle the `/dashboard` slash command. We might have others assigned to this app too!
        // The rules are simple: If there is no text following the command, treat it as though they had requested "help"
        console.log('Dashboard command');

        // if no text was supplied, treat it as a help command
        if (message.text === "" || message.text === "help") {
          bot.replyPrivate(message,
                "I'm able to give you the dashboards that you need\n" +
                "Try typing `/dashboard cpu` to see.\n" +
                "Available options: cpu, temp, network, energy and stats");
            return;
        }

        // if cpu text was supplied, treat it as a dashboard of cpu
        else if (message.text === "cpu") {

          console.log('CPU dashboard');
          bot.replyPublic(message,'Dashboard will be uploaded within a few seconds...');

          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&orgId=1&panelId=10&from=-12h&to=now&width=1500&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);      
          // bot.replyPrivate(message,'Only the person who used the slash command can see this.');
          return;
        } else if (message.text === "temp") { // if temp text was supplied, treat it as a dashboard of temperatures

          bot.replyPublic(message,'Dashboards (3) will be uploaded within a few seconds...');

          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&orgId=1&panelId=18&from=-24h&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);
          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&panelId=20&orgId=1&from=-24h&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);
          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&panelId=7&orgId=1&from=-24h&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);

          return;
        } else if (message.text === "network") { // if cpu text was supplied, treat it as a dashboard of network status

          bot.replyPublic(message,'Dashboard will be uploaded within a few seconds...');

          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&orgId=1&panelId=11&from=-12h&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);
          return;
        } else if (message.text === "energy") { // if cpu text was supplied, treat it as a dashboard of energy consumption

          bot.replyPublic(message,'Dashboards (2) will be uploaded within a few seconds...');

          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/Lib3XcGmk/home?panelId=6&orgId=1&from=-31d&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard); 
          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/Lib3XcGmk/home?panelId=2&orgId=1&from=-24h&to=now&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);
          return;
        } else if (message.text === "stats") { // if cpu text was supplied, treat it as a dashboard of energy consumption

          bot.replyPublic(message,'Dashboard will be uploaded within a few seconds...');

          download('http://' + process.env.grafanaUser + ':' + process.env.grafanaPass + '@' + process.env.grafanaHTTP + '/render/d-solo/000000001/unraid?refresh=1m&panelId=38&orgId=1&tab=general&from=1533467746377&to=1533510946377&width=1000&height=500&tz=Europe%2FLisbon', upload_file, uploadDashboard);
          return;

        } else {
          bot.replyPublic(message, "I'm afraid I don't know which dashboard " + message.text + " is.");
          return;
        }

          break;
        default:
        bot.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");
    }
  })
}


function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('clientId=<MY SLACK CLIENT ID> clientSecret=<MY CLIENT SECRET> PORT=3000 studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js');
    console.log('Get Slack app credentials here: https://api.slack.com/apps')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}