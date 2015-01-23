var http = require('http'),
	connect = require('connect'),
	serveStatic = require('serve-static'),
	Promise = require('bluebird'),
	Crawler = require('./lib/extractor').Crawler;

 
function runTests() {
	mocha.run(function(failures){
		process.exit(failures);
	});
};

// Fire up server for local testing (we don't want to hit a live site with huge amounts of testing traffic)
connect().use(serveStatic(__dirname)).listen(8181, function() {
	var crawler = new Crawler('tests/config/test.json');
	crawler.start().then(function() {
		console.log("DONE!");
	})
});

